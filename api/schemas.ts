import { z } from 'zod';

export const ClaimInputSchema = z.object({
  claimId: z.string().min(1),
  claimText: z.string().min(1).max(1000),
  sentenceContext: z.string().min(1).max(500),
});
export type ClaimInput = z.infer<typeof ClaimInputSchema>;

export const FactInputSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1).max(2000),
  sourceName: z.string().min(1),
});
export type FactInput = z.infer<typeof FactInputSchema>;

export const AnalyzeRequestSchema = z.object({
  claims: z.array(ClaimInputSchema).min(1).max(20),
  facts: z.array(FactInputSchema).max(50),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const VerificationStatusSchema = z.enum([
  'SUPPORTED',
  'CONFLICT_FOUND',
  'UNVERIFIED',
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const DowngradeReasonSchema = z.enum([
  'MALFORMED_RESPONSE',
  'FABRICATED_FACT_ID',
  'QUOTE_NOT_IN_SOURCE',
  'FABRICATED_CONFLICT_EVIDENCE',
  'RATE_LIMITED',
  'PROVIDER_ERROR',
  'TIMEOUT',
  'INJECTION_SUSPECTED',
  'AI_OFFLINE_FALLBACK',
  'NETWORK_ERROR',
  'NO_RELEVANT_FACTS',
]);
export type DowngradeReason = z.infer<typeof DowngradeReasonSchema>;

export const ClaimResultSchema = z.object({
  claimId: z.string().min(1),
  status: VerificationStatusSchema,
  sourceFactId: z.string().nullable(),
  exactSourceQuote: z.string().nullable(),
  rationale: z.string().max(500),
  reason: DowngradeReasonSchema.optional(),
});
export type ClaimResult = z.infer<typeof ClaimResultSchema>;

export const AnalyzeResponseSchema = z.object({
  mode: z.enum(['LIVE', 'OFFLINE_FALLBACK']),
  results: z.array(ClaimResultSchema),
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
