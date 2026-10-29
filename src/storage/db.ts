import { z } from 'zod';
import type { AuditEvent } from '../engine/audit-chain';
import { RuleSchema, FactSchema, type Rule, type Fact } from '../engine/types';

export const DraftSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  text: z.string(),
  revision: z.number().int(),
  updatedAt: z.string(),
});
export type DraftRecord = z.infer<typeof DraftSchema>;

export const RevisionEntrySchema = z.object({
  id: z.string(),
  revision: z.number().int().nonnegative(),
  timestamp: z.string(),
  diffDescription: z.string(),
  replacedSpan: z.string(),
  newContent: z.string(),
  snapshotText: z.string(),
});
export type RevisionEntry = z.infer<typeof RevisionEntrySchema>;

export const AuditEventSchema = z.object({
  eventId: z.string(),
  action: z.string(),
  actorRole: z.enum(['AUTHOR', 'REVIEWER', 'COMPLIANCE']),
  draftId: z.string(),
  draftFingerprint: z.string(),
  payload: z.unknown(),
  timestamp: z.string(),
  prevHash: z.string(),
  hash: z.string(),
});

export const PersistedExportEnvelopeSchema = z.object({
  disclosure: z.string().optional(),
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  draftId: z.string().optional(),
  draftText: z.string().optional(),
  draft: z
    .object({
      schemaVersion: z.number().int(),
      id: z.string(),
      text: z.string(),
      revision: z.number().int(),
    })
    .optional(),
  rules: z.array(z.any()).optional(),
  facts: z.array(z.any()).optional(),
  events: z.array(AuditEventSchema),
});
export type PersistedExportEnvelope = z.infer<typeof PersistedExportEnvelopeSchema>;

export interface ImportResult {
  success: boolean;
  events?: AuditEvent[];
  draftText?: string;
  revision?: number;
  rules?: Rule[];
  facts?: Fact[];
  error?: 'UNSUPPORTED_SCHEMA_VERSION' | 'INVALID_ENVELOPE' | 'INTEGRITY_COMPROMISED';
  receivedVersion?: number;
  warning?: string;
}

let corruptedRecordCount = 0;
export function getCorruptedRecordCount(): number {
  return corruptedRecordCount;
}
export function resetCorruptedRecordCount(): void {
  corruptedRecordCount = 0;
}

// ---------------------------------------------------------------------------
// Pure IndexedDB Engine (with In-Memory Fallback for Node/Vitest)
// ---------------------------------------------------------------------------
const DB_NAME = 'brandguard_audit_governance_v1';
const DB_VERSION = 1;

let inMemoryDraft: { schemaVersion: number; id: string; text: string; revision: number; updatedAt: string } | null = null;
let inMemoryEvents: AuditEvent[] = [];
let inMemoryRevisions: RevisionEntry[] = [];
let inMemoryRules: Rule[] | null = null;
let inMemoryFacts: Fact[] | null = null;

function getIDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  return null;
}

function openDatabase(): Promise<IDBDatabase | null> {
  const idb = getIDB();
  if (!idb) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events', { keyPath: 'eventId' });
        }
        if (!db.objectStoreNames.contains('revisions')) {
          db.createObjectStore('revisions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('rules')) {
          db.createObjectStore('rules', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('facts')) {
          db.createObjectStore('facts', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// ---------------------------------------------------------------------------
// Draft Persistence
// ---------------------------------------------------------------------------
export async function saveDraftToIndexedDB(
  text: string,
  revision: number
): Promise<{ schemaVersion: number; id: string; text: string; revision: number; updatedAt: string }> {
  const record = {
    schemaVersion: 1,
    id: 'current_draft',
    text,
    revision,
    updatedAt: new Date().toISOString(),
  };

  inMemoryDraft = record;

  const db = await openDatabase();
  if (db) {
    try {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      store.put(record);
    } catch {
      // Ignore write errors
    }
  }

  return record;
}

export async function loadDraftFromIndexedDB(): Promise<{
  schemaVersion: number;
  id: string;
  text: string;
  revision: number;
  updatedAt: string;
} | null> {
  const db = await openDatabase();
  if (!db) return inMemoryDraft;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('drafts', 'readonly');
      const store = tx.objectStore('drafts');
      const req = store.get('current_draft');
      req.onsuccess = () => {
        if (req.result) {
          const parsed = DraftSchema.safeParse(req.result);
          if (parsed.success) {
            inMemoryDraft = parsed.data;
            resolve(parsed.data);
          } else {
            corruptedRecordCount++;
            resolve(null);
          }
        } else {
          resolve(inMemoryDraft);
        }
      };
      req.onerror = () => resolve(inMemoryDraft);
    } catch {
      resolve(inMemoryDraft);
    }
  });
}

// ---------------------------------------------------------------------------
// Audit Events Persistence
// ---------------------------------------------------------------------------
export class AuditPersistenceStore {
  public static loadEvents(): AuditEvent[] {
    return [...inMemoryEvents];
  }

  public static async loadEventsAsync(): Promise<AuditEvent[]> {
    const db = await openDatabase();
    if (!db) return [...inMemoryEvents];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction('events', 'readonly');
        const store = tx.objectStore('events');
        const req = store.getAll();
        req.onsuccess = () => {
          if (Array.isArray(req.result) && req.result.length > 0) {
            const validEvents: AuditEvent[] = [];
            for (const item of req.result) {
              const parsed = AuditEventSchema.safeParse(item);
              if (parsed.success) {
                validEvents.push(parsed.data as AuditEvent);
              } else {
                corruptedRecordCount++;
              }
            }
            inMemoryEvents = validEvents;
            resolve([...inMemoryEvents]);
          } else {
            resolve([...inMemoryEvents]);
          }
        };
        req.onerror = () => resolve([...inMemoryEvents]);
      } catch {
        resolve([...inMemoryEvents]);
      }
    });
  }

  public static saveEvents(events: readonly AuditEvent[]): void {
    inMemoryEvents = [...events];
    openDatabase().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction('events', 'readwrite');
        const store = tx.objectStore('events');
        store.clear();
        for (const evt of events) {
          store.put(evt);
        }
      } catch {
        // Ignore write errors
      }
    });
  }

  public static clear(): void {
    inMemoryEvents = [];
    openDatabase().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction('events', 'readwrite');
        tx.objectStore('events').clear();
      } catch {
        // Ignore clear errors
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Revision Log Persistence
// ---------------------------------------------------------------------------
export class RevisionStore {
  private entries: RevisionEntry[] = [];

  constructor() {
    this.entries = [...inMemoryRevisions];
    this.initFromIDB();
  }

  private async initFromIDB(): Promise<void> {
    const db = await openDatabase();
    if (!db) return;
    try {
      const tx = db.transaction('revisions', 'readonly');
      const store = tx.objectStore('revisions');
      const req = store.getAll();
      req.onsuccess = () => {
        if (Array.isArray(req.result) && req.result.length > 0) {
          this.entries = req.result.reverse();
          inMemoryRevisions = [...this.entries];
        }
      };
    } catch {
      // Ignore IDB errors
    }
  }

  public list(): RevisionEntry[] {
    return [...this.entries];
  }

  public append(entry: Omit<RevisionEntry, 'id' | 'timestamp'>): RevisionEntry {
    const fullEntry: RevisionEntry = {
      ...entry,
      id: `REV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.entries.unshift(fullEntry);
    inMemoryRevisions = [...this.entries];

    openDatabase().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction('revisions', 'readwrite');
        tx.objectStore('revisions').put(fullEntry);
      } catch {
        // Ignore
      }
    });

    return fullEntry;
  }

  public clear(): void {
    this.entries = [];
    inMemoryRevisions = [];
    openDatabase().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction('revisions', 'readwrite');
        tx.objectStore('revisions').clear();
      } catch {
        // Ignore
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Rulebook & Facts Persistence
// ---------------------------------------------------------------------------
export async function saveRulesToIndexedDB(rules: Rule[]): Promise<void> {
  inMemoryRules = [...rules];
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction('rules', 'readwrite');
    const store = tx.objectStore('rules');
    store.clear();
    for (const r of rules) {
      store.put({ ...r, schemaVersion: 1 });
    }
  } catch {
    // Ignore
  }
}

export async function loadRulesFromIndexedDB(): Promise<Rule[] | null> {
  const db = await openDatabase();
  if (!db) return inMemoryRules;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('rules', 'readonly');
      const req = tx.objectStore('rules').getAll();
      req.onsuccess = () => {
        if (Array.isArray(req.result) && req.result.length > 0) {
          const validRules: Rule[] = [];
          for (const item of req.result) {
            const parsed = RuleSchema.safeParse(item);
            if (parsed.success) {
              validRules.push(parsed.data);
            } else {
              corruptedRecordCount++;
            }
          }
          inMemoryRules = validRules;
          resolve(validRules);
        } else {
          resolve(inMemoryRules);
        }
      };
      req.onerror = () => resolve(inMemoryRules);
    } catch {
      resolve(inMemoryRules);
    }
  });
}

export async function saveFactsToIndexedDB(facts: Fact[]): Promise<void> {
  inMemoryFacts = [...facts];
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction('facts', 'readwrite');
    const store = tx.objectStore('facts');
    store.clear();
    for (const f of facts) {
      store.put({ ...f, schemaVersion: 1 });
    }
  } catch {
    // Ignore
  }
}

export async function loadFactsFromIndexedDB(): Promise<Fact[] | null> {
  const db = await openDatabase();
  if (!db) return inMemoryFacts;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction('facts', 'readonly');
      const req = tx.objectStore('facts').getAll();
      req.onsuccess = () => {
        if (Array.isArray(req.result) && req.result.length > 0) {
          const validFacts: Fact[] = [];
          for (const item of req.result) {
            const parsed = FactSchema.safeParse(item);
            if (parsed.success) {
              validFacts.push(parsed.data);
            } else {
              corruptedRecordCount++;
            }
          }
          inMemoryFacts = validFacts;
          resolve(validFacts);
        } else {
          resolve(inMemoryFacts);
        }
      };
      req.onerror = () => resolve(inMemoryFacts);
    } catch {
      resolve(inMemoryFacts);
    }
  });
}

// ---------------------------------------------------------------------------
// Workspace JSON Export & Import
// ---------------------------------------------------------------------------
export function createWorkspaceExportEnvelope(
  draftText: string,
  revision: number,
  rules: Rule[],
  facts: Fact[],
  events: readonly AuditEvent[]
): string {
  const timestamp = new Date().toISOString();
  const envelope = {
    disclosure: `Exported ${timestamp} from BrandGuard AI. Local-only data.`,
    schemaVersion: 1,
    exportedAt: timestamp,
    draft: {
      schemaVersion: 1,
      id: 'DRAFT-01',
      text: draftText,
      revision,
    },
    rules,
    facts,
    events,
  };

  return JSON.stringify(envelope, null, 2);
}

export function importAuditEnvelope(raw: unknown): ImportResult {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { success: false, error: 'INVALID_ENVELOPE' };
    }
  }

  if (!raw || typeof raw !== 'object') {
    return { success: false, error: 'INVALID_ENVELOPE' };
  }

  // Schema version enforcement
  if ('schemaVersion' in raw) {
    const v = (raw as Record<string, unknown>).schemaVersion;
    if (typeof v === 'number' && v !== 1) {
      return {
        success: false,
        error: 'UNSUPPORTED_SCHEMA_VERSION',
        receivedVersion: v,
      };
    }
  }

  const parsed = PersistedExportEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'INVALID_ENVELOPE' };
  }

  const data = parsed.data;
  const draftText = data.draft?.text || data.draftText;
  const revision = data.draft?.revision || 1;

  return {
    success: true,
    events: data.events as unknown as AuditEvent[],
    draftText,
    revision,
    rules: data.rules as Rule[] | undefined,
    facts: data.facts as Fact[] | undefined,
  };
}

// ---------------------------------------------------------------------------
// Preset Reset Helpers
// ---------------------------------------------------------------------------
export async function resetPreset(presetId: string): Promise<void> {
  const normalizedNum = presetId.replace(/^P/i, '');
  const targetDraftId = `PRESET-${normalizedNum}-DRAFT`;

  const existingEvents = AuditPersistenceStore.loadEvents();
  const filteredEvents = existingEvents.filter(
    (e) => e.draftId !== targetDraftId && e.draftId !== presetId
  );
  AuditPersistenceStore.saveEvents(filteredEvents);
}

export function filterPresetRules<T extends { id: string }>(items: T[], presetId: string): T[] {
  const normalizedNum = presetId.replace(/^P/i, '');
  const prefix = `PRESET-${normalizedNum}-RULE-`;
  return items.filter((item) => !item.id.startsWith(prefix));
}

export function filterPresetFacts<T extends { id: string }>(items: T[], presetId: string): T[] {
  const normalizedNum = presetId.replace(/^P/i, '');
  const prefix = `PRESET-${normalizedNum}-FACT-`;
  return items.filter((item) => !item.id.startsWith(prefix));
}
