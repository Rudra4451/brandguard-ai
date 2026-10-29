import type { Finding, Rule, Fact } from '../engine/types';
import type { ClaimVerification } from '../engine/claim-verifier';
import type { AuditEvent } from '../engine/audit-chain';
import type { ReviewState, ActorRole } from '../components/layout/TopBar';

export type CheckStatus = 'PASS' | 'FAIL' | 'CONDITIONAL_PASS' | 'SKIPPED';

export interface CheckAssertionResult {
  passed: boolean;
  actual: string;
  expected?: string;
  status?: CheckStatus;
}

export interface ExpectedCheck {
  id: string;
  description: string;
  expected: string;
  assert: (result: BenchRunOutput) => CheckAssertionResult;
}

export interface BenchFinding extends Finding {
  _source: 'ENGINE';
  ratio?: number;
}

export interface BenchRunOutput {
  presetId: 'P1' | 'P2' | 'P3' | 'P4';
  draftId: string;
  draftText: string;
  findings: BenchFinding[];
  claimVerifications: Map<string, ClaimVerification>;
  verifierMode: 'AI_ACTIVE' | 'AI_OFFLINE_FALLBACK' | 'AI_DEGRADED';
  reviewStateBeforeEdit?: ReviewState;
  reviewStateAfterEdit?: ReviewState;
  sealedFingerprint?: string;
  currentFingerprint?: string;
  isChainValid?: boolean;
  invalidationEvent?: AuditEvent;
  allEvents?: AuditEvent[];
  contrastRatio?: number;
  metadata?: Record<string, unknown>;
}

export interface CheckResult {
  id: string;
  description: string;
  expected: string;
  actual: string;
  status: CheckStatus;
}

export interface PresetResult {
  presetId: 'P1' | 'P2' | 'P3' | 'P4';
  name: string;
  status: CheckStatus;
  durationMs: number;
  findings: BenchFinding[];
  claimVerifications: Map<string, ClaimVerification>;
  checkResults: CheckResult[];
  rawOutput: BenchRunOutput;
}

export interface BenchContext {
  inspect: (draft: string, rules: Rule[], facts: Fact[], channel: string) => Finding[];
  verifyClaims: (candidates: Finding[], facts: Fact[]) => Promise<ClaimVerification[]>;
  recordAuditEvent: (action: any, role: ActorRole, draftId: string, text: string, payload: unknown) => Promise<AuditEvent>;
  verifyChain: (events: readonly AuditEvent[]) => Promise<{ valid: boolean; breakAt: number | null }>;
  computeApprovalFingerprint: (payload: any) => Promise<string>;
  fullRulebookVersion: string;
  fullFactStoreVersion: string;
  actorRole: ActorRole;
}

export interface PresetDefinition {
  presetId: 'P1' | 'P2' | 'P3' | 'P4';
  name: string;
  purpose: string;
  draftId: string;
  channel: string;
  draftText: string;
  rules: Rule[];
  facts: Fact[];
  expectedChecks: ExpectedCheck[];
  run: (ctx: BenchContext) => Promise<PresetResult>;
}

export interface BenchSummary {
  total: number;
  passCount: number;
  conditionalPassCount: number;
  failCount: number;
  skippedCount: number;
  totalDurationMs: number;
}
