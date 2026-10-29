import {
  AnalyzeRequestSchema,
  type AnalyzeResponse,
  type ClaimResult,
  type FactInput,
} from './schemas';
import type { GeminiClient, RawLLMClaimResult } from './gemini-client';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'up', 'about', 'into', 'over', 'after', 'beneath', 'under', 'above', 'this',
  'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
  'has', 'had', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'shall', 'should',
  'may', 'might', 'must', 'our', 'your', 'their', 'its', 'my', 'his', 'her',
]);

/**
 * Normalizes text for deterministic quote verification:
 * NFKD unicode normalization, lowercase, collapsed whitespace, trimmed trailing punctuation.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:]+$/, '');
}

/**
 * Filters facts sharing at least one non-stopword token of length >= 4 with the claim, capped at 5.
 */
export function filterRelevantFacts(claimText: string, facts: FactInput[]): FactInput[] {
  const words = claimText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

  if (words.length === 0) {
    return [];
  }

  const matches: { fact: FactInput; score: number }[] = [];
  for (const fact of facts) {
    const factLower = fact.statement.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (factLower.includes(w)) {
        score++;
      }
    }
    if (score > 0) {
      matches.push({ fact, score });
    }
  }

  // Sort by score desc, cap at 5
  return matches.sort((a, b) => b.score - a.score).slice(0, 5).map((m) => m.fact);
}

/**
 * Injection defense layer 3: post-response validator.
 * Returns true if rationale contains forbidden URLs, actions, or commands.
 */
export function containsInjectionSuspect(rationale: string | undefined | null): boolean {
  if (!rationale || typeof rationale !== 'string') {
    return false;
  }
  if (
    rationale.includes('http://') ||
    rationale.includes('https://') ||
    rationale.includes('javascript:')
  ) {
    return true;
  }
  if (/you (should|must|need to)/i.test(rationale)) {
    return true;
  }
  return false;
}


/**
 * Core claim-verification service with deterministic two-stage verification and retry policies.
 */
export async function processAnalyzeRequest(
  body: unknown,
  geminiClient: GeminiClient | null,
  apiKeyProvided: boolean
): Promise<{ status: number; data: AnalyzeResponse | { error: string } }> {
  // 1. Zod request validation
  const parseResult = AnalyzeRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return {
      status: 400,
      data: { error: 'Invalid request: ' + parseResult.error.message },
    };
  }

  const { claims, facts } = parseResult.data;

  // 2. Offline Fallback check
  if (!apiKeyProvided || !geminiClient) {
    const fallbackResults: ClaimResult[] = claims.map((c) => ({
      claimId: c.claimId,
      status: 'UNVERIFIED',
      sourceFactId: null,
      exactSourceQuote: null,
      rationale: 'AI verification unavailable — deterministic rules only.',
      reason: 'AI_OFFLINE_FALLBACK',
    }));
    return {
      status: 200,
      data: { mode: 'OFFLINE_FALLBACK', results: fallbackResults },
    };
  }

  // Fact lookup map by ID
  const factMap = new Map<string, FactInput>();
  for (const f of facts) {
    factMap.set(f.id, f);
  }

  // 3. Pre-filter facts per claim
  const claimsToQuery: typeof claims = [];
  const preFilteredResults: ClaimResult[] = [];
  const allRelevantFactsMap = new Map<string, FactInput>();

  for (const c of claims) {
    const relevant = filterRelevantFacts(c.claimText, facts);
    if (relevant.length === 0) {
      preFilteredResults.push({
        claimId: c.claimId,
        status: 'UNVERIFIED',
        sourceFactId: null,
        exactSourceQuote: null,
        rationale: 'No approved facts share relevant terms with this claim.',
        reason: 'NO_RELEVANT_FACTS',
      });
    } else {
      claimsToQuery.push(c);
      for (const rf of relevant) {
        allRelevantFactsMap.set(rf.id, rf);
      }
    }
  }

  if (claimsToQuery.length === 0) {
    return {
      status: 200,
      data: { mode: 'LIVE', results: preFilteredResults },
    };
  }

  // 4. Query GeminiClient with timeout and retry policies
  // Retry policy:
  // - 429: exponential backoff [500, 1000, 2000] ms, max 3 attempts total
  // - 5xx: 1 retry at 1000 ms
  // - Format/Schema error: 1 retry
  // - Timeout (8s per attempt): no retry
  let rawResponse: { results: RawLLMClaimResult[] } | null = null;
  let lastErrorReason: ClaimResult['reason'] = 'PROVIDER_ERROR';

  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      rawResponse = await geminiClient.verify({
        claims: claimsToQuery,
        relevantFacts: Array.from(allRelevantFactsMap.values()),
        signal: controller.signal,
      });
      clearTimeout(timer);
      break;
    } catch (err: unknown) {
      clearTimeout(timer);
      const errMsg = err instanceof Error ? err.message : String(err);

      if (errMsg.includes('aborted') || errMsg.includes('TIMEOUT') || controller.signal.aborted) {
        lastErrorReason = 'TIMEOUT';
        break; // Timeout -> no retry
      }

      if (errMsg.includes('429') || errMsg.toLowerCase().includes('rate')) {
        lastErrorReason = 'RATE_LIMITED';
        if (attempt < maxAttempts) {
          const delays = [500, 1000, 2000];
          await new Promise((res) => setTimeout(res, delays[attempt - 1] || 1000));
          continue;
        }
        break;
      }

      if (errMsg.includes('500') || errMsg.includes('503') || errMsg.includes('504')) {
        lastErrorReason = 'PROVIDER_ERROR';
        if (attempt === 1) {
          await new Promise((res) => setTimeout(res, 1000));
          continue;
        }
        break;
      }

      if (errMsg.includes('MALFORMED_RESPONSE')) {
        lastErrorReason = 'MALFORMED_RESPONSE';
        if (attempt === 1) {
          continue; // 1 retry on format failure
        }
        break;
      }

      lastErrorReason = 'PROVIDER_ERROR';
      break;
    }
  }

  // If provider failed all retries
  if (!rawResponse || !Array.isArray(rawResponse.results)) {
    const errorResults: ClaimResult[] = claimsToQuery.map((c) => ({
      claimId: c.claimId,
      status: 'UNVERIFIED',
      sourceFactId: null,
      exactSourceQuote: null,
      rationale: `Provider verification failed: ${lastErrorReason}`,
      reason: lastErrorReason,
    }));
    return {
      status: 200,
      data: { mode: 'LIVE', results: [...preFilteredResults, ...errorResults] },
    };
  }

  // 5. Validate that every input claimId appears exactly once
  const returnedClaimIds = new Set(rawResponse.results.map((r) => r.claimId));
  const hasAllClaims = claimsToQuery.every((c) => returnedClaimIds.has(c.claimId));
  const hasNoDuplicates = returnedClaimIds.size === rawResponse.results.length;

  if (!hasAllClaims || !hasNoDuplicates) {
    const malformedResults: ClaimResult[] = claimsToQuery.map((c) => ({
      claimId: c.claimId,
      status: 'UNVERIFIED',
      sourceFactId: null,
      exactSourceQuote: null,
      rationale: 'Provider returned missing or duplicate claim IDs.',
      reason: 'MALFORMED_RESPONSE',
    }));
    return {
      status: 200,
      data: { mode: 'LIVE', results: [...preFilteredResults, ...malformedResults] },
    };
  }

  // 6. Two-stage verification and injection validation per result
  const verifiedResults: ClaimResult[] = [];

  for (const raw of rawResponse.results) {
    if (!raw.rationale || typeof raw.rationale !== 'string') {
      verifiedResults.push({
        claimId: raw.claimId,
        status: 'UNVERIFIED',
        sourceFactId: null,
        exactSourceQuote: null,
        rationale: 'Malformed response: missing or invalid rationale string.',
        reason: 'MALFORMED_RESPONSE',
      });
      continue;
    }

    // Defense Layer 3: Check for injection markers in rationale
    if (containsInjectionSuspect(raw.rationale)) {
      verifiedResults.push({
        claimId: raw.claimId,
        status: 'UNVERIFIED',
        sourceFactId: null,
        exactSourceQuote: null,
        rationale: 'Untrusted action or URL detected in rationale output.',
        reason: 'INJECTION_SUSPECTED',
      });
      continue;
    }

    if (raw.status === 'SUPPORTED') {
      // Step 4.1: Lookup fact
      if (!raw.sourceFactId || !factMap.has(raw.sourceFactId)) {
        verifiedResults.push({
          claimId: raw.claimId,
          status: 'UNVERIFIED',
          sourceFactId: null,
          exactSourceQuote: null,
          rationale: raw.rationale.slice(0, 500),
          reason: 'FABRICATED_FACT_ID',
        });
        continue;
      }

      const fact = factMap.get(raw.sourceFactId)!;
      if (!raw.exactSourceQuote) {
        verifiedResults.push({
          claimId: raw.claimId,
          status: 'UNVERIFIED',
          sourceFactId: null,
          exactSourceQuote: null,
          rationale: raw.rationale.slice(0, 500),
          reason: 'QUOTE_NOT_IN_SOURCE',
        });
        continue;
      }

      // Step 4.2 & 4.3: Deterministic quote substring check
      const normalizedFact = normalize(fact.statement);
      const normalizedQuote = normalize(raw.exactSourceQuote);

      if (!normalizedFact.includes(normalizedQuote)) {
        verifiedResults.push({
          claimId: raw.claimId,
          status: 'UNVERIFIED',
          sourceFactId: null,
          exactSourceQuote: null,
          rationale: raw.rationale.slice(0, 500),
          reason: 'QUOTE_NOT_IN_SOURCE',
        });
        continue;
      }

      // Passed quote verification
      verifiedResults.push({
        claimId: raw.claimId,
        status: 'SUPPORTED',
        sourceFactId: raw.sourceFactId,
        exactSourceQuote: raw.exactSourceQuote,
        rationale: raw.rationale.slice(0, 500),
      });
      continue;
    }

    if (raw.status === 'CONFLICT_FOUND') {
      // CONFLICT_FOUND requires an actual source quote that contradicts the claim
      if (!raw.sourceFactId || !factMap.has(raw.sourceFactId) || !raw.exactSourceQuote) {
        verifiedResults.push({
          claimId: raw.claimId,
          status: 'UNVERIFIED',
          sourceFactId: null,
          exactSourceQuote: null,
          rationale: raw.rationale.slice(0, 500),
          reason: 'FABRICATED_CONFLICT_EVIDENCE',
        });
        continue;
      }

      const fact = factMap.get(raw.sourceFactId)!;
      const normalizedFact = normalize(fact.statement);
      const normalizedQuote = normalize(raw.exactSourceQuote);

      if (!normalizedFact.includes(normalizedQuote)) {
        verifiedResults.push({
          claimId: raw.claimId,
          status: 'UNVERIFIED',
          sourceFactId: null,
          exactSourceQuote: null,
          rationale: raw.rationale.slice(0, 500),
          reason: 'FABRICATED_CONFLICT_EVIDENCE',
        });
        continue;
      }

      verifiedResults.push({
        claimId: raw.claimId,
        status: 'CONFLICT_FOUND',
        sourceFactId: raw.sourceFactId,
        exactSourceQuote: raw.exactSourceQuote,
        rationale: raw.rationale.slice(0, 500),
      });
      continue;
    }

    // Default: UNVERIFIED
    verifiedResults.push({
      claimId: raw.claimId,
      status: 'UNVERIFIED',
      sourceFactId: raw.sourceFactId || null,
      exactSourceQuote: null,
      rationale: raw.rationale ? raw.rationale.slice(0, 500) : 'Claim unsupported by approved facts.',
    });
  }

  return {
    status: 200,
    data: { mode: 'LIVE', results: [...preFilteredResults, ...verifiedResults] },
  };
}
