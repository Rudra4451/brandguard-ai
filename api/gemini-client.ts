import type { ClaimInput, FactInput } from './schemas';

export interface RawLLMClaimResult {
  claimId: string;
  status: 'SUPPORTED' | 'CONFLICT_FOUND' | 'UNVERIFIED';
  sourceFactId: string | null;
  exactSourceQuote: string | null;
  rationale: string;
}

export interface RawLLMResponse {
  results: RawLLMClaimResult[];
}

export interface VerifyPayload {
  claims: ClaimInput[];
  relevantFacts: FactInput[];
  signal?: AbortSignal;
}

export interface GeminiClient {
  verify(payload: VerifyPayload): Promise<RawLLMResponse>;
}
