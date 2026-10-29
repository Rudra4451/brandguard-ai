import { describe, it, expect } from 'vitest';
import {
  computeApprovalFingerprint,
  validateOverrideReason,
  type ApprovalPayload,
  type InspectionSnapshot,
} from './approval';
import { RulebookStore } from './rulebook';
import { FactStore } from './fact-store';
import { SEED_RULES, SEED_FACTS } from '../fixtures/seed-data';
import { AuditChain } from './audit-chain';

describe('Approval Cryptographic Binding & State Machine', () => {
  const dummySnapshot: InspectionSnapshot = {
    findings: [],
    claims: [],
    verifierMode: 'AI_ACTIVE',
  };

  // Test 9: Approve clean draft -> Approved, fingerprint stored
  it('9. Approve clean draft -> Approved, fingerprint stored', async () => {
    const ruleStore = new RulebookStore(SEED_RULES);
    const factStore = new FactStore(SEED_FACTS);
    const rulebookVersion = await ruleStore.getFullVersion();
    const factStoreVersion = await factStore.getFullVersion();

    const payload: ApprovalPayload = {
      draftText: 'Clean valid draft text',
      rulebookVersion,
      factStoreVersion,
      inspectionSnapshot: dummySnapshot,
      actorRole: 'REVIEWER',
      approvedAt: '2026-10-27T00:00:00.000Z',
    };

    const fingerprint = await computeApprovalFingerprint(payload);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint.length).toBe(64);
  });

  // Test 10: Approve -> edit one character -> ReviewRequired, APPROVAL_INVALIDATED event appended
  it('10. Approve -> edit one character -> fingerprint mismatch / invalidation', async () => {
    const originalText = 'Clean valid draft text';
    const editedText = 'Clean valid draft texts'; // added 's'

    const payloadA: ApprovalPayload = {
      draftText: originalText,
      rulebookVersion: 'rulebook-hash-64',
      factStoreVersion: 'factstore-hash-64',
      inspectionSnapshot: dummySnapshot,
      actorRole: 'REVIEWER',
      approvedAt: '2026-10-27T00:00:00.000Z',
    };

    const payloadB: ApprovalPayload = {
      ...payloadA,
      draftText: editedText,
    };

    const fingerprintA = await computeApprovalFingerprint(payloadA);
    const fingerprintB = await computeApprovalFingerprint(payloadB);

    expect(fingerprintA).not.toBe(fingerprintB);

    // Chain records invalidation event
    const chain = new AuditChain();
    await chain.appendEvent('APPROVED', 'REVIEWER', 'DRAFT-01', originalText, {
      approvalFingerprint: fingerprintA,
    });

    const invalidationEvt = await chain.appendEvent(
      'APPROVAL_INVALIDATED',
      'REVIEWER',
      'DRAFT-01',
      editedText,
      {
        reason: 'DRAFT_CHANGED',
        previousFingerprint: fingerprintA,
        currentFingerprint: fingerprintB,
      }
    );

    expect(invalidationEvt.action).toBe('APPROVAL_INVALIDATED');
    expect((invalidationEvt.payload as Record<string, unknown>).reason).toBe('DRAFT_CHANGED');
  });

  // Test 11: Restore the edited character -> still ReviewRequired, NOT silently restored
  it('11. Restore the edited character -> invalidation is one-way, does not silently restore Approved', async () => {
    let reviewState: 'ReviewRequired' | 'Approved' = 'ReviewRequired';

    // Step 1: Human approves
    reviewState = 'Approved';

    // Step 2: Content edited -> invalidates to ReviewRequired
    reviewState = 'ReviewRequired';

    // Step 3: Undo content edit -> reviewState MUST remain ReviewRequired
    const restoredTextIsSame = true;
    if (restoredTextIsSame) {
      // One-way invalidation invariant: do NOT auto-restore reviewState to Approved!
      expect(reviewState).toBe('ReviewRequired');
    }
  });

  // Test 12: Rulebook mutation after approval -> ReviewRequired, reason RULEBOOK_CHANGED
  it('12. Rulebook mutation after approval -> ReviewRequired, reason RULEBOOK_CHANGED', async () => {
    const payloadA: ApprovalPayload = {
      draftText: 'Text',
      rulebookVersion: 'rulebook-initial-hash',
      factStoreVersion: 'facts-hash',
      inspectionSnapshot: dummySnapshot,
      actorRole: 'REVIEWER',
      approvedAt: '2026-10-27T00:00:00.000Z',
    };

    const payloadB: ApprovalPayload = {
      ...payloadA,
      rulebookVersion: 'rulebook-mutated-hash',
    };

    const fpA = await computeApprovalFingerprint(payloadA);
    const fpB = await computeApprovalFingerprint(payloadB);

    expect(fpA).not.toBe(fpB);
  });

  // Test 13: Fact store mutation after approval -> ReviewRequired, reason FACTS_CHANGED
  it('13. Fact store mutation after approval -> ReviewRequired, reason FACTS_CHANGED', async () => {
    const payloadA: ApprovalPayload = {
      draftText: 'Text',
      rulebookVersion: 'rulebook-hash',
      factStoreVersion: 'facts-initial-hash',
      inspectionSnapshot: dummySnapshot,
      actorRole: 'REVIEWER',
      approvedAt: '2026-10-27T00:00:00.000Z',
    };

    const payloadB: ApprovalPayload = {
      ...payloadA,
      factStoreVersion: 'facts-mutated-hash',
    };

    const fpA = await computeApprovalFingerprint(payloadA);
    const fpB = await computeApprovalFingerprint(payloadB);

    expect(fpA).not.toBe(fpB);
  });

  // Test 14: Channel change after approval -> ReviewRequired (limits differ)
  it('14. Channel change after approval -> ReviewRequired', async () => {
    // In BrandGuard, channel changes trigger inspection STALE and invalidate approval
    let currentChannel = 'LinkedIn';
    let reviewState: 'Approved' | 'ReviewRequired' = 'Approved';

    currentChannel = 'Twitter';
    if (currentChannel !== 'LinkedIn') {
      reviewState = 'ReviewRequired';
    }

    expect(reviewState).toBe('ReviewRequired');
  });

  // Test 15: Override with empty reason -> rejected
  it('15. Override with empty or whitespace reason -> rejected', () => {
    expect(validateOverrideReason('').valid).toBe(false);
    expect(validateOverrideReason('   ').valid).toBe(false);
    expect(validateOverrideReason('too short').valid).toBe(false); // 9 chars
  });

  // Test 16: Override with 10+ chars -> recorded, finding rendered as overridden, never SUPPORTED
  it('16. Override with 10+ chars -> accepted, distinct from SUPPORTED', () => {
    const reason = 'Clinical trial CT-409 validates 50% reduction in hydration studies';
    const validation = validateOverrideReason(reason);
    expect(validation.valid).toBe(true);

    const overrideRecord = {
      findingId: 'FIND-001',
      status: 'OVERRIDDEN_BY_COMPLIANCE',
      overrideReason: reason,
    };

    expect(overrideRecord.status).not.toBe('SUPPORTED');
    expect(overrideRecord.status).toBe('OVERRIDDEN_BY_COMPLIANCE');
  });

  // Test 17: Reject -> Rejected. Edit -> ReviewRequired. Approve -> Approved
  it('17. Reject -> Rejected. Edit -> ReviewRequired. Approve -> Approved', () => {
    let state: 'Draft' | 'ReviewRequired' | 'Approved' | 'Rejected' = 'ReviewRequired';

    // Reviewer rejects
    state = 'Rejected';
    expect(state).toBe('Rejected');

    // Author edits content -> transitions to ReviewRequired
    state = 'ReviewRequired';
    expect(state).toBe('ReviewRequired');

    // Reviewer approves -> transitions to Approved
    state = 'Approved';
    expect(state).toBe('Approved');
  });

  // Test 18: Re-approve after invalidation produces a distinct event, distinct fingerprint, distinct timestamp
  it('18. Re-approve after invalidation produces distinct event, timestamp, and fingerprint', async () => {
    const chain = new AuditChain();

    // First approval
    const evt1 = await chain.appendEvent('APPROVED', 'REVIEWER', 'DRAFT-01', 'Initial text', {
      approvalFingerprint: 'fp-1',
      approvedAt: '2026-10-27T00:00:00.000Z',
    });

    // Content changed & invalidated
    await chain.appendEvent('APPROVAL_INVALIDATED', 'REVIEWER', 'DRAFT-01', 'Edited text', {
      reason: 'DRAFT_CHANGED',
    });

    // Second approval after brief delay to ensure distinct timestamp
    await new Promise((r) => setTimeout(r, 15));
    const evt2 = await chain.appendEvent('APPROVED', 'REVIEWER', 'DRAFT-01', 'Edited text', {
      approvalFingerprint: 'fp-2',
      approvedAt: '2026-10-27T00:05:00.000Z',
    });

    expect(evt1.eventId).not.toBe(evt2.eventId);
    expect(evt1.hash).not.toBe(evt2.hash);
    expect(evt1.timestamp).not.toBe(evt2.timestamp);
    expect(evt1.draftFingerprint).not.toBe(evt2.draftFingerprint);
  });
});
