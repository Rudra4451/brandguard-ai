import { describe, it, expect } from 'vitest';
import {
  canonicalJSON,
  verifyChain,
  AuditChain,
  GENESIS_HASH_INPUT,
  type AuditEvent,
} from './audit-chain';
import { sha256 } from './hasher';
import { importAuditEnvelope } from '../storage/db';

describe('Audit Chain & Canonical Serialization', () => {
  // Test 1: Canonical JSON: same logical object with different key insertion order hashes identically
  it('1. Canonical JSON: same logical object with different key insertion order hashes identically', async () => {
    const objA = { z: 'last', a: 'first', m: 42, nested: { b: 2, a: 1 } };
    const objB = { nested: { a: 1, b: 2 }, a: 'first', m: 42, z: 'last' };

    const canonA = canonicalJSON(objA);
    const canonB = canonicalJSON(objB);

    expect(canonA).toBe(canonB);
    const hashA = await sha256(canonA);
    const hashB = await sha256(canonB);
    expect(hashA).toBe(hashB);
  });

  // Test 2: Canonical JSON: array order matters (sorted vs unsorted produces different hashes) — confirm insertion order is preserved
  it('2. Canonical JSON: array order matters (insertion order preserved)', async () => {
    const arr1 = [1, 2, 3];
    const arr2 = [3, 2, 1];

    const canon1 = canonicalJSON(arr1);
    const canon2 = canonicalJSON(arr2);

    expect(canon1).toBe('[1,2,3]');
    expect(canon2).toBe('[3,2,1]');
    expect(canon1).not.toBe(canon2);

    const hash1 = await sha256(canon1);
    const hash2 = await sha256(canon2);
    expect(hash1).not.toBe(hash2);
  });

  // Test 3: Canonical JSON: undefined keys omitted, null keys preserved
  it('3. Canonical JSON: undefined keys omitted, null keys preserved', () => {
    const obj = {
      keptNull: null,
      omittedUndef: undefined,
      nested: {
        keep: null,
        drop: undefined,
      },
    };

    const canon = canonicalJSON(obj);
    expect(canon).toBe('{"keptNull":null,"nested":{"keep":null}}');
    expect(canon).not.toContain('omittedUndef');
    expect(canon).not.toContain('drop');
  });

  // Test 4: Genesis: H[0] is the fixed string. First event prevHash matches
  it('4. Genesis: H[0] is the fixed string. First event prevHash matches', async () => {
    const chain = new AuditChain();
    const genesisHash = await chain.initGenesis();
    const expectedGenesis = await sha256(GENESIS_HASH_INPUT);

    expect(genesisHash).toBe(expectedGenesis);

    const evt1 = await chain.appendEvent('DRAFT_CREATED', 'AUTHOR', 'DRAFT-01', 'Initial text', {
      source: 'manual',
    });

    expect(evt1.prevHash).toBe(expectedGenesis);
  });

  // Test 5: Chain verify: intact chain returns valid: true
  it('5. Chain verify: intact chain returns valid: true', async () => {
    const chain = new AuditChain();
    await chain.appendEvent('DRAFT_CREATED', 'AUTHOR', 'DRAFT-01', 'Initial text', {});
    await chain.appendEvent('AUDIT_RUN', 'REVIEWER', 'DRAFT-01', 'Initial text', { findingsCount: 0 });
    await chain.appendEvent('APPROVED', 'COMPLIANCE', 'DRAFT-01', 'Initial text', { approvalFingerprint: 'abc' });

    const verification = await chain.verify();
    expect(verification.valid).toBe(true);
    expect(verification.breakAt).toBeNull();
  });

  // Test 6: Chain verify: tamper event 3's payload -> valid: false, breakAt: 3 (1-indexed index in events array is index 2)
  it('6. Chain verify: tamper event 3 payload -> valid: false, breakAt: 2', async () => {
    const chain = new AuditChain();
    await chain.appendEvent('DRAFT_CREATED', 'AUTHOR', 'DRAFT-01', 'Text 1', {});
    await chain.appendEvent('AUDIT_RUN', 'REVIEWER', 'DRAFT-01', 'Text 1', {});
    await chain.appendEvent('APPROVED', 'COMPLIANCE', 'DRAFT-01', 'Text 1', { reason: 'Clean draft' });

    const rawEvents: AuditEvent[] = [...chain.getEvents()];
    // Tamper the 3rd event (index 2) payload
    const tamperedThirdEvent: AuditEvent = {
      ...rawEvents[2],
      payload: { reason: 'Tampered reason' },
    };
    rawEvents[2] = tamperedThirdEvent;

    const result = await verifyChain(rawEvents);
    expect(result.valid).toBe(false);
    expect(result.breakAt).toBe(2);
  });

  // Test 7: Chain verify: tamper event 3's hash directly -> valid: false, breakAt: 2
  it('7. Chain verify: tamper event 3 hash directly -> valid: false, breakAt: 2', async () => {
    const chain = new AuditChain();
    await chain.appendEvent('DRAFT_CREATED', 'AUTHOR', 'DRAFT-01', 'Text 1', {});
    await chain.appendEvent('AUDIT_RUN', 'REVIEWER', 'DRAFT-01', 'Text 1', {});
    await chain.appendEvent('APPROVED', 'COMPLIANCE', 'DRAFT-01', 'Text 1', {});

    const rawEvents: AuditEvent[] = [...chain.getEvents()];
    rawEvents[2] = {
      ...rawEvents[2],
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
    };

    const result = await verifyChain(rawEvents);
    expect(result.valid).toBe(false);
    expect(result.breakAt).toBe(2);
  });

  // Test 8: Chain verify: empty chain returns valid: false, breakAt: 0
  it('8. Chain verify: empty chain returns valid: false, breakAt: 0', async () => {
    const result = await verifyChain([]);
    expect(result.valid).toBe(false);
    expect(result.breakAt).toBe(0);
  });

  // Append-only runtime guard test
  it('Append-only runtime guard forbids splice or mutation', async () => {
    const chain = new AuditChain();
    await chain.appendEvent('DRAFT_CREATED', 'AUTHOR', 'DRAFT-01', 'Text', {});

    const internalEvents = (chain as unknown as { events: AuditEvent[] }).events;
    expect(() => {
      internalEvents.splice(0, 1);
    }).toThrow('AuditChain is append-only: splice is prohibited.');
  });

  // Test 19: Import with schemaVersion: 2 -> rejected with UNSUPPORTED_SCHEMA_VERSION
  it('19. Import with schemaVersion: 2 -> rejected with UNSUPPORTED_SCHEMA_VERSION', () => {
    const payload = {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      draftId: 'DRAFT-01',
      draftText: 'Some draft text',
      events: [],
    };

    const result = importAuditEnvelope(payload);
    expect(result.success).toBe(false);
    expect(result.error).toBe('UNSUPPORTED_SCHEMA_VERSION');
    expect(result.receivedVersion).toBe(2);
  });

  // Test 20: Import with corrupted H[i] -> verifyChain fails
  it('20. Import with corrupted H[i] -> verifyChain fails', async () => {
    const chain = new AuditChain();
    await chain.appendEvent('DRAFT_CREATED', 'AUTHOR', 'DRAFT-01', 'Text', {});
    await chain.appendEvent('AUDIT_RUN', 'REVIEWER', 'DRAFT-01', 'Text', {});

    const events = [...chain.getEvents()];
    // Corrupt the second event hash
    events[1] = {
      ...events[1],
      hash: 'corruptedhash1234567890abcdef',
    };

    const result = await verifyChain(events);
    expect(result.valid).toBe(false);
    expect(result.breakAt).toBe(1);
  });

  // Test 22: Role switch between approve and dismiss -> two events with distinct actorRole
  it('22. Role switch between actions records distinct actorRole fields', async () => {
    const chain = new AuditChain();

    // Reviewer approves
    const evt1 = await chain.appendEvent('APPROVED', 'REVIEWER', 'DRAFT-01', 'Text', {
      approvalFingerprint: 'f1',
    });

    // Author dismisses
    const evt2 = await chain.appendEvent('FINDING_DISMISSED', 'AUTHOR', 'DRAFT-01', 'Text', {
      findingId: 'FIND-001',
    });

    expect(evt1.actorRole).toBe('REVIEWER');
    expect(evt2.actorRole).toBe('AUTHOR');
    expect(evt1.actorRole).not.toBe(evt2.actorRole);
  });
});
