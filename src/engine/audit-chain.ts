import { sha256 } from './hasher';

/**
 * Deterministic canonical JSON serialization according to BrandGuard audit specifications:
 * - Objects: keys sorted ascending (ASCII / byte-wise), no whitespace.
 * - Arrays: insertion order strictly preserved.
 * - undefined properties: omitted entirely.
 * - null: emitted as null.
 * - Numbers: Number.isFinite required; emit via String(n). Reject NaN / Infinity.
 * - Strings: standard JSON escaping.
 * - Encoding: UTF-8 string output.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot canonically serialize non-finite number: ${value}`);
    }
    return String(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const elements = value.map((item) => (item === undefined ? 'null' : canonicalJSON(item)));
    return '[' + elements.join(',') + ']';
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort(); // ASCII/byte-wise sort
    const entries: string[] = [];

    for (const key of keys) {
      const val = obj[key];
      if (val !== undefined) {
        entries.push(`${JSON.stringify(key)}:${canonicalJSON(val)}`);
      }
    }

    return '{' + entries.join(',') + '}';
  }

  // Symbol, function, or undefined at top-level
  return '';
}

export const GENESIS_HASH_INPUT = 'BRANDGUARD_AUDIT_V1_GENESIS';

export type AuditAction =
  | 'DRAFT_CREATED'
  | 'AUDIT_RUN'
  | 'REWRITE_APPLIED'
  | 'FINDING_DISMISSED'
  | 'FINDING_OVERRIDE'
  | 'APPROVED'
  | 'REJECTED'
  | 'APPROVAL_INVALIDATED'
  | 'AUDIT_EXPORTED';

export type ActorRole = 'AUTHOR' | 'REVIEWER' | 'COMPLIANCE';

export interface AuditEvent {
  readonly eventId: string; // e.g. "EVT-0001"
  readonly action: AuditAction;
  readonly actorRole: ActorRole;
  readonly draftId: string;
  readonly draftFingerprint: string; // SHA-256 of draftText at event time
  readonly payload: unknown;
  readonly timestamp: string; // ISO 8601 UTC YYYY-MM-DDTHH:mm:ss.sssZ
  readonly prevHash: string;
  readonly hash: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  breakAt: number | null;
  errorReason?: string;
}

/**
 * Computes event hash: H[i] = SHA-256(H[i-1] + "|" + canonicalJSON(eventWithoutHash))
 */
export async function computeEventHash(
  prevHash: string,
  eventData: Omit<AuditEvent, 'hash'>
): Promise<string> {
  const serialized = canonicalJSON({
    action: eventData.action,
    actorRole: eventData.actorRole,
    draftFingerprint: eventData.draftFingerprint,
    draftId: eventData.draftId,
    eventId: eventData.eventId,
    payload: eventData.payload,
    prevHash: eventData.prevHash,
    timestamp: eventData.timestamp,
  });

  return sha256(prevHash + '|' + serialized);
}

/**
 * Verifies the integrity of an audit event chain:
 * 1. Checks that the chain is non-empty (empty chain returns valid: false, breakAt: 0).
 * 2. Validates H[0] genesis link on event 0.
 * 3. Verifies each event's hash equals computeEventHash(prevHash, event).
 * 4. Validates events[i].prevHash === events[i-1].hash.
 * 5. Returns first break index if tampering is detected.
 */
export async function verifyChain(events: readonly AuditEvent[]): Promise<ChainVerificationResult> {
  if (!events || events.length === 0) {
    return { valid: false, breakAt: 0, errorReason: 'CHAIN_EMPTY' };
  }

  const genesisHash = await sha256(GENESIS_HASH_INPUT);

  for (let i = 0; i < events.length; i++) {
    const current = events[i];

    // Check prevHash
    if (i === 0) {
      if (current.prevHash !== genesisHash) {
        return { valid: false, breakAt: 0, errorReason: 'GENESIS_PREV_HASH_MISMATCH' };
      }
    } else {
      const prev = events[i - 1];
      if (current.prevHash !== prev.hash) {
        return { valid: false, breakAt: i, errorReason: 'CHAIN_LINK_MISMATCH' };
      }
    }

    // If event payload embeds a draftText snapshot, verify draftFingerprint matches
    if (current.payload && typeof current.payload === 'object' && 'draftText' in current.payload) {
      const embeddedText = String((current.payload as Record<string, unknown>).draftText);
      const computedDraftHash = await sha256(embeddedText);
      if (computedDraftHash !== current.draftFingerprint) {
        return { valid: false, breakAt: i, errorReason: 'DRAFT_FINGERPRINT_MISMATCH' };
      }
    }

    // Recompute current event hash
    const expectedHash = await computeEventHash(current.prevHash, current);
    if (current.hash !== expectedHash) {
      return { valid: false, breakAt: i, errorReason: 'EVENT_HASH_MISMATCH' };
    }
  }

  return { valid: true, breakAt: null };
}

/**
 * Append-only tamper-evident audit chain log.
 * Enforces runtime immutability and throws if mutation is attempted.
 */
export class AuditChain {
  private readonly events: AuditEvent[];
  private genesisHash: string = '';

  constructor(initialEvents: AuditEvent[] = []) {
    const rawEvents: AuditEvent[] = [];
    for (const evt of initialEvents) {
      rawEvents.push(Object.freeze({ ...evt }));
    }

    // Create a runtime proxy guard that forbids splice, pop, shift, or mutation
    this.events = new Proxy(rawEvents, {
      set(target, prop, val, receiver) {
        const num = Number(prop);
        if (!isNaN(num) && num < target.length) {
          throw new Error('AuditChain is append-only: mutating existing events is prohibited.');
        }
        return Reflect.set(target, prop, val, receiver);
      },
      deleteProperty() {
        throw new Error('AuditChain is append-only: deleting events is prohibited.');
      },
      get(target, prop, receiver) {
        if (prop === 'splice' || prop === 'pop' || prop === 'shift' || prop === 'unshift') {
          return () => {
            throw new Error(`AuditChain is append-only: ${String(prop)} is prohibited.`);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  public async initGenesis(): Promise<string> {
    if (!this.genesisHash) {
      this.genesisHash = await sha256(GENESIS_HASH_INPUT);
    }
    return this.genesisHash;
  }

  public getEvents(): readonly AuditEvent[] {
    return Object.freeze([...this.events]);
  }

  public async appendEvent(
    action: AuditAction,
    actorRole: ActorRole,
    draftId: string,
    draftText: string,
    payload: unknown
  ): Promise<AuditEvent> {
    const genesis = await this.initGenesis();
    const prevHash = this.events.length === 0 ? genesis : this.events[this.events.length - 1].hash;
    const seq = this.events.length + 1;
    const eventId = `EVT-${String(seq).padStart(4, '0')}`;
    const timestamp = new Date().toISOString();
    const draftFingerprint = await sha256(draftText);

    const eventData: Omit<AuditEvent, 'hash'> = {
      eventId,
      action,
      actorRole,
      draftId,
      draftFingerprint,
      payload,
      timestamp,
      prevHash,
    };

    const hash = await computeEventHash(prevHash, eventData);

    const fullEvent: AuditEvent = Object.freeze({
      ...eventData,
      hash,
    });

    this.events.push(fullEvent);
    return fullEvent;
  }

  public async verify(): Promise<ChainVerificationResult> {
    return verifyChain(this.events);
  }
}
