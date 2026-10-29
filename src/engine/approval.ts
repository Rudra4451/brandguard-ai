import { sha256 } from './hasher';
import { canonicalJSON, type ActorRole } from './audit-chain';
import type { Finding } from './types';
import type { ClaimResult } from '../../api/schemas';

export type VerifierMode = 'AI_ACTIVE' | 'AI_OFFLINE_FALLBACK' | 'AI_DEGRADED';

export type ReviewDecisionState =
  | 'Draft'
  | 'ReviewRequired'
  | 'Approved'
  | 'Rejected';

export type InvalidationReason =
  | 'DRAFT_CHANGED'
  | 'RULEBOOK_CHANGED'
  | 'FACTS_CHANGED'
  | 'SNAPSHOT_STALE';

export interface InspectionSnapshot {
  findings: Finding[];
  claims: ClaimResult[];
  verifierMode: VerifierMode;
}

export interface ApprovalPayload {
  draftText: string;
  rulebookVersion: string; // FULL 64-char hash
  factStoreVersion: string; // FULL 64-char hash
  inspectionSnapshot: InspectionSnapshot;
  actorRole: ActorRole;
  approvedAt: string; // ISO 8601 UTC
}

export interface OverrideRecord {
  findingId: string;
  overrideReason: string;
  actorRole: ActorRole;
  timestamp: string;
}

/**
 * Computes the 64-char SHA-256 approval fingerprint over the canonical representation
 * of all approval grounds (draft, rulebook version, fact store version, inspection snapshot, role, timestamp).
 */
export async function computeApprovalFingerprint(payload: ApprovalPayload): Promise<string> {
  // Ensure findings and claims are canonically sorted
  const sortedFindings = [...payload.inspectionSnapshot.findings].sort((a, b) => {
    if (a.severity !== b.severity) {
      const order = { VIOLATION: 3, NOTICE: 2, CANDIDATE: 1 };
      return (order[b.severity] || 0) - (order[a.severity] || 0);
    }
    const numA = parseInt(a.sentenceId.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.sentenceId.replace(/\D/g, '') || '0', 10);
    if (numA !== numB) return numA - numB;
    return a.startOffset - b.startOffset;
  });

  const sortedClaims = [...payload.inspectionSnapshot.claims].sort((a, b) =>
    a.claimId.localeCompare(b.claimId)
  );

  const canonicalObj = {
    actorRole: payload.actorRole,
    approvedAt: payload.approvedAt,
    draftText: payload.draftText,
    factStoreVersion: payload.factStoreVersion,
    inspectionSnapshot: {
      claims: sortedClaims,
      findings: sortedFindings,
      verifierMode: payload.inspectionSnapshot.verifierMode,
    },
    rulebookVersion: payload.rulebookVersion,
  };

  const serialized = canonicalJSON(canonicalObj);
  return sha256(serialized);
}

/**
 * Validates whether a finding override reason meets compliance requirements (min 10 non-whitespace chars).
 */
export function validateOverrideReason(reason: string): { valid: boolean; error?: string } {
  if (!reason || reason.trim().length < 10) {
    return {
      valid: false,
      error: 'Override reason must contain at least 10 non-whitespace characters.',
    };
  }
  return { valid: true };
}
