import type { Finding, Fact } from './types';
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  ClaimResult,
  DowngradeReason,
  VerificationStatus,
} from '../../api/schemas';

export interface ClaimVerification {
  claimId: string;
  status: VerificationStatus;
  sourceFactId: string | null;
  exactSourceQuote: string | null;
  rationale: string;
  reason?: DowngradeReason;
  mode?: 'LIVE' | 'OFFLINE_FALLBACK';
}

/**
 * Synchronous single-claim verifier returning fallback UNVERIFIED result without network I/O.
 */
export function verifyClaim(
  candidate: Finding,
  _facts: Fact[]
): { status: 'UNVERIFIED'; reason: 'AI_VERIFIER_NOT_IMPLEMENTED'; candidateId: string } {
  return {
    status: 'UNVERIFIED',
    reason: 'AI_VERIFIER_NOT_IMPLEMENTED',
    candidateId: candidate.id,
  };
}

/**
 * Async claim verifier querying the server-side /api/analyze gateway.

 * Never throws on network failure; gracefully returns UNVERIFIED with NETWORK_ERROR.
 * Never establishes SUPPORTED without valid server-verified source quotes.
 */
export async function verifyClaims(
  candidates: Finding[],
  facts: Fact[],
  signal?: AbortSignal
): Promise<ClaimVerification[]> {
  if (candidates.length === 0) {
    return [];
  }

  // Construct request payload with strictly fragments and context, NEVER the full draft
  const payload: AnalyzeRequest = {
    claims: candidates.map((c) => ({
      claimId: c.id,
      claimText: c.candidateText || c.flaggedText,
      // Pass sentence context (limited to 500 chars)
      sentenceContext: c.flaggedText.slice(0, 500),
    })),
    facts: facts.map((f) => ({
      id: f.id,
      statement: f.statement.slice(0, 2000),
      sourceName: f.sourceName,
    })),
  };

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      return candidates.map((c) => ({
        claimId: c.id,
        status: 'UNVERIFIED',
        sourceFactId: null,
        exactSourceQuote: null,
        rationale: `Server responded with status ${res.status}.`,
        reason: 'PROVIDER_ERROR',
        mode: 'OFFLINE_FALLBACK',
      }));
    }

    const data = (await res.json()) as AnalyzeResponse;
    const resultMap = new Map<string, ClaimResult>();
    for (const r of data.results) {
      resultMap.set(r.claimId, r);
    }

    return candidates.map((c) => {
      const result = resultMap.get(c.id);
      if (result) {
        return {
          ...result,
          mode: data.mode,
        };
      }
      return {
        claimId: c.id,
        status: 'UNVERIFIED',
        sourceFactId: null,
        exactSourceQuote: null,
        rationale: 'Missing verification result for claim candidate.',
        reason: 'MALFORMED_RESPONSE',
        mode: data.mode,
      };
    });
  } catch {
    // Network or fetch abort failure: return all UNVERIFIED, reason: NETWORK_ERROR
    return candidates.map((c) => ({
      claimId: c.id,
      status: 'UNVERIFIED',
      sourceFactId: null,
      exactSourceQuote: null,
      rationale: 'Network connection to claim-verification gateway failed.',
      reason: 'NETWORK_ERROR',
      mode: 'OFFLINE_FALLBACK',
    }));
  }
}
