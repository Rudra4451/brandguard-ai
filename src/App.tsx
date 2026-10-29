import { useState, useRef, useEffect } from 'react';
import { NavigationRail, type ViewType } from './components/layout/NavigationRail';
import { TopBar, type ReviewState, type InspectionState, type SaveState, type ActorRole } from './components/layout/TopBar';
import { AuditStatusRegion } from './components/layout/AuditStatusRegion';
import { EditorPane } from './components/editor/EditorPane';
import { type Channel } from './components/editor/EditorToolbar';
import { FindingsList } from './components/diagnostics/FindingsList';
import { EvidenceInspector } from './components/diagnostics/EvidenceInspector';
import { DataTable, type Column } from './components/primitives/DataTable';
import { StatusBadge } from './components/primitives/StatusBadge';
import { Button } from './components/primitives/Button';
import { SEED_RULES, SEED_FACTS, SEED_DRAFT } from './fixtures/seed-data';
import { inspect } from './engine/deterministic';
import { RulebookStore } from './engine/rulebook';
import { FactStore } from './engine/fact-store';
import {
  RevisionStore,
  AuditPersistenceStore,
  saveDraftToIndexedDB,
  loadDraftFromIndexedDB,
  saveRulesToIndexedDB,
  loadRulesFromIndexedDB,
  saveFactsToIndexedDB,
  loadFactsFromIndexedDB,
  createWorkspaceExportEnvelope,
  importAuditEnvelope,
  getCorruptedRecordCount,
} from './storage/db';
import { sha256 } from './engine/hasher';
import { AuditChain, type AuditEvent } from './engine/audit-chain';
import { computeApprovalFingerprint, type ApprovalPayload, type InspectionSnapshot } from './engine/approval';
import { verifyClaims, type ClaimVerification } from './engine/claim-verifier';
import { AuditReport } from './report/AuditReport';
import { JudgeBench } from './bench/JudgeBench';
import { InsightsView } from './insights/InsightsView';
import { LandingPage } from './landing/LandingPage';
import type { BenchContext } from './bench/types';
import type { Rule, Fact, Finding } from './engine/types';
import type { ClaimResult } from '../api/schemas';

export function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'app'>('landing');
  const [activeView, setActiveView] = useState<ViewType>('workspace');
  const [reviewState, setReviewState] = useState<ReviewState>('DRAFT');
  const [inspectionState, setInspectionState] = useState<InspectionState>('UNAUDITED');
  const [saveState, setSaveState] = useState<SaveState>('SAVED');
  const [actorRole, setActorRole] = useState<ActorRole>('REVIEWER');

  const [channel, setChannel] = useState<Channel>('LinkedIn');
  const [signedDigest, setSignedDigest] = useState<string | null>(null);
  const [hashChainState, setHashChainState] = useState<string>('GENESIS_PENDING');

  // Stores
  const [ruleStore] = useState(() => new RulebookStore(SEED_RULES));
  const [factStore] = useState(() => new FactStore(SEED_FACTS));
  const [revisionStore] = useState(() => new RevisionStore());

  const [rules, setRules] = useState<Rule[]>(() => ruleStore.list());
  const [facts, setFacts] = useState<Fact[]>(() => factStore.list());
  const [fullRulebookVersion, setFullRulebookVersion] = useState<string>('');
  const [fullFactStoreVersion, setFullFactStoreVersion] = useState<string>('');

  // Audit Chain
  const [auditChain] = useState(() => new AuditChain(AuditPersistenceStore.loadEvents()));
  const [events, setEvents] = useState<readonly AuditEvent[]>(() => auditChain.getEvents());
  const [isChainValid, setIsChainValid] = useState<boolean>(true);
  const [chainBreakAt, setChainBreakAt] = useState<number | null>(null);

  // Draft state and revision
  const [draftContent, setDraftContent] = useState<string>(SEED_DRAFT);
  const [revision, setRevision] = useState<number>(1);
  const [restoredDraftNotice, setRestoredDraftNotice] = useState<string | null>(null);
  const [corruptedStorageDetected, setCorruptedStorageDetected] = useState<boolean>(() => getCorruptedRecordCount() > 0);
  const [reportTimestamp, setReportTimestamp] = useState<string>(() => new Date().toISOString());

  // Findings and dismissal state
  const [activeFindings, setActiveFindings] = useState<Finding[]>([]);
  const [dismissedFindingIds, setDismissedFindingIds] = useState<Set<string>>(new Set());
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [claimVerifications, setClaimVerifications] = useState<Map<string, ClaimVerification>>(new Map());
  const [isInspectorOpenMobile, setIsInspectorOpenMobile] = useState<boolean>(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  // Modal / Form state for Rule and Fact CRUD
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [ruleFormId, setRuleFormId] = useState('');
  const [ruleFormDesc, setRuleFormDesc] = useState('');
  const [ruleFormCategory, setRuleFormCategory] = useState<Rule['category']>('BANNED_PHRASE');
  const [ruleFormSeverity, setRuleFormSeverity] = useState<Rule['severity']>('VIOLATION');
  const [ruleFormTerm, setRuleFormTerm] = useState('');
  const [ruleFormReplacement, setRuleFormReplacement] = useState('');

  const [isAddFactOpen, setIsAddFactOpen] = useState(false);
  const [editingFact, setEditingFact] = useState<Fact | null>(null);
  const [factFormId, setFactFormId] = useState('');
  const [factFormStatement, setFactFormStatement] = useState('');
  const [factFormSourceName, setFactFormSourceName] = useState('');

  // Last approval payload to detect invalidations
  const [lastApprovalPayload, setLastApprovalPayload] = useState<ApprovalPayload | null>(null);

  // Ref to EditorPane's safe rewrite function
  const applyRewriteRef = useRef<((from: number, to: number, replacement: string) => void) | null>(null);
  const draftContentRef = useRef(draftContent);

  useEffect(() => {
    draftContentRef.current = draftContent;
  }, [draftContent]);

  // Initialize store versions and load persistent storage on mount
  useEffect(() => {
    ruleStore.getFullVersion().then((fv) => setFullRulebookVersion(fv));
    factStore.getFullVersion().then((fv) => setFullFactStoreVersion(fv));

    // Verify chain on mount
    auditChain.verify().then((res) => {
      if (auditChain.getEvents().length === 0) {
        setIsChainValid(true);
        setChainBreakAt(null);
        setHashChainState('GENESIS_PENDING');
      } else {
        setIsChainValid(res.valid);
        setChainBreakAt(res.breakAt);
        const last = auditChain.getEvents()[auditChain.getEvents().length - 1];
        setHashChainState(`${last.eventId}_${last.hash.slice(0, 8)}`);
      }
    });

    // Check IndexedDB draft recovery
    loadDraftFromIndexedDB().then((saved) => {
      if (saved && saved.text && saved.text !== draftContentRef.current) {
        setDraftContent(saved.text);
        setRevision(saved.revision || 1);
        setRestoredDraftNotice(`Restored autosaved draft (Rev #${saved.revision || 1}, ${saved.text.length} chars) from local IndexedDB.`);
      }
    });

    // Load persisted rules
    loadRulesFromIndexedDB().then(async (savedRules) => {
      if (savedRules && savedRules.length > 0) {
        for (const r of savedRules) {
          if (!ruleStore.get(r.id)) {
            await ruleStore.create(r);
          }
        }
        const updated = ruleStore.list();
        setRules(updated);
        const fv = await ruleStore.getFullVersion();
        setFullRulebookVersion(fv);
      }
    });

    // Load persisted facts
    loadFactsFromIndexedDB().then(async (savedFacts) => {
      if (savedFacts && savedFacts.length > 0) {
        for (const f of savedFacts) {
          if (!factStore.get(f.id)) {
            factStore.create(f);
          }
        }
        const updated = factStore.list();
        setFacts(updated);
        const fv = await factStore.getFullVersion();
        setFullFactStoreVersion(fv);
      }
    });
  }, [ruleStore, factStore, auditChain]);

  // Debounced autosave: 2000ms after last keystroke
  useEffect(() => {
    const timer = setTimeout(async () => {
      await saveDraftToIndexedDB(draftContent, revision);
      setSaveState('SAVED');
    }, 2000);
    return () => clearTimeout(timer);
  }, [draftContent, revision]);

  // Channel limit lookup from rules
  const currentChannelLimit = rules.find(
    (r) =>
      r.category === 'CHANNEL_LIMIT' &&
      r.matchingStrategy.type === 'channelLimit' &&
      r.matchingStrategy.channel.toLowerCase() === channel.toLowerCase()
  )?.matchingStrategy;
  const channelLimitChars =
    currentChannelLimit && currentChannelLimit.type === 'channelLimit'
      ? currentChannelLimit.maxChars
      : undefined;

  // Append audit event helper with automatic chain update and persistence
  const recordAuditEvent = async (
    action: Parameters<typeof auditChain.appendEvent>[0],
    role: ActorRole,
    payload: unknown
  ) => {
    const evt = await auditChain.appendEvent(action, role, 'DRAFT-01', draftContent, payload);
    const updatedEvents = auditChain.getEvents();
    setEvents(updatedEvents);
    AuditPersistenceStore.saveEvents(updatedEvents);

    const verification = await auditChain.verify();
    setIsChainValid(verification.valid);
    setChainBreakAt(verification.breakAt);
    setHashChainState(`${evt.eventId}_${evt.hash.slice(0, 8)}`);
    return evt;
  };

  // Invalidate approval helper
  const invalidateApproval = async (reason: 'DRAFT_CHANGED' | 'RULEBOOK_CHANGED' | 'FACTS_CHANGED' | 'SNAPSHOT_STALE') => {
    if (reviewState === 'APPROVED' && signedDigest) {
      setReviewState('RE_REVIEW_REQUESTED');
      await recordAuditEvent('APPROVAL_INVALIDATED', actorRole, {
        reason,
        previousFingerprint: signedDigest,
      });
    }
  };

  // Rule CRUD handlers
  const handleSaveRule = async () => {
    if (!ruleFormId || !ruleFormDesc) return;
    try {
      const matchingStrategy: Rule['matchingStrategy'] =
        ruleFormCategory === 'REQUIRED_DISCLAIMER'
          ? {
              type: 'requiredDisclosure',
              text: ruleFormTerm || ruleFormDesc,
              caseSensitive: false,
            }
          : {
              type: 'phrase',
              phrase: ruleFormTerm || 'prohibited',
              caseSensitive: false,
              wordBoundary: true,
            };

      const newRule: Rule = {
        id: ruleFormId,
        description: ruleFormDesc,
        category: ruleFormCategory,
        severity: ruleFormCategory === 'DISCOURAGED_TERM' ? 'NOTICE' : 'VIOLATION',
        enabled: true,
        explanation: ruleFormReplacement ? `Consider using "${ruleFormReplacement}" instead.` : undefined,
        matchingStrategy,
      };

      if (editingRule) {
        await ruleStore.update(editingRule.id, newRule);
      } else {
        await ruleStore.create(newRule);
      }

      const updated = ruleStore.list();
      setRules(updated);
      await saveRulesToIndexedDB(updated);
      const newVer = await ruleStore.getFullVersion();
      setFullRulebookVersion(newVer);

      setIsAddRuleOpen(false);
      setEditingRule(null);
      await invalidateApproval('RULEBOOK_CHANGED');
      setInspectionState('STALE');
    } catch (err) {
      alert(`Rule save error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await ruleStore.delete(id);
      const updated = ruleStore.list();
      setRules(updated);
      await saveRulesToIndexedDB(updated);
      const newVer = await ruleStore.getFullVersion();
      setFullRulebookVersion(newVer);
      await invalidateApproval('RULEBOOK_CHANGED');
      setInspectionState('STALE');
    } catch (err) {
      alert(`Delete error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Fact CRUD handlers
  const handleSaveFact = async () => {
    if (!factFormId || !factFormStatement || !factFormSourceName) return;
    try {
      const factData: Fact = {
        id: factFormId,
        statement: factFormStatement,
        sourceName: factFormSourceName,
        version: 1,
      };

      if (editingFact) {
        factStore.update(editingFact.id, factData);
      } else {
        factStore.create(factData);
      }

      const updated = factStore.list();
      setFacts(updated);
      await saveFactsToIndexedDB(updated);
      const newVer = await factStore.getFullVersion();
      setFullFactStoreVersion(newVer);

      setIsAddFactOpen(false);
      setEditingFact(null);
      await invalidateApproval('FACTS_CHANGED');
      setInspectionState('STALE');
    } catch (err) {
      alert(`Fact save error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteFact = async (id: string) => {
    try {
      factStore.delete(id);
      const updated = factStore.list();
      setFacts(updated);
      await saveFactsToIndexedDB(updated);
      const newVer = await factStore.getFullVersion();
      setFullFactStoreVersion(newVer);
      await invalidateApproval('FACTS_CHANGED');
      setInspectionState('STALE');
    } catch (err) {
      alert(`Delete error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Manual re-inspection (Option A) with async claim verification
  const handleRunAudit = async () => {
    try {
      setEngineError(null);
      const results = inspect(draftContent, rules, facts, channel);
      setActiveFindings(results);
      setDismissedFindingIds(new Set());
      setInspectionState('INSPECTED');

      if (selectedFinding) {
        const stillPresent = results.find((f) => f.id === selectedFinding.id);
        setSelectedFinding(stillPresent || null);
      }

      // Query claim verifier for claim candidates asynchronously
      const candidates = results.filter((f) => f.category === 'CLAIM_CANDIDATE');
      let verifierMode: 'AI_ACTIVE' | 'AI_OFFLINE_FALLBACK' = 'AI_OFFLINE_FALLBACK';

      if (candidates.length > 0) {
        const verifications = await verifyClaims(candidates, facts);
        const map = new Map<string, ClaimVerification>();
        for (const v of verifications) {
          map.set(v.claimId, v);
          if (v.mode === 'LIVE') verifierMode = 'AI_ACTIVE';
        }
        setClaimVerifications(map);
      } else {
        setClaimVerifications(new Map());
      }

      await recordAuditEvent('AUDIT_RUN', actorRole, {
        findingsCount: results.length,
        claimCount: candidates.length,
        verifierMode,
        categories: Array.from(new Set(results.map((r) => r.category))),
      });
    } catch (err) {
      setEngineError(err instanceof Error ? err.message : String(err));
    }
  };

  // Content change handler from editor
  const handleContentChange = (newText: string) => {
    setDraftContent(newText);
    setSaveState('UNSAVED');

    if (inspectionState === 'INSPECTED') {
      setInspectionState('STALE');
    }

    if (reviewState === 'APPROVED') {
      invalidateApproval('DRAFT_CHANGED');
    }
  };

  // Channel change handler
  const handleChannelChange = (newChannel: Channel) => {
    setChannel(newChannel);
    if (inspectionState === 'INSPECTED') {
      setInspectionState('STALE');
    }
    if (reviewState === 'APPROVED') {
      invalidateApproval('DRAFT_CHANGED');
    }
  };

  // Safe rewrite apply handler
  const handleApplyRewrite = async (replacement: string) => {
    if (!selectedFinding || !applyRewriteRef.current) return;

    const flagged = selectedFinding.flaggedText;
    const prevText = draftContent;

    const sentenceStart = draftContent.indexOf(flagged);
    if (sentenceStart !== -1) {
      const from = sentenceStart + 1;
      const to = from + flagged.length;
      applyRewriteRef.current(from, to, replacement);
    }

    const nextRev = revision + 1;
    setRevision(nextRev);
    revisionStore.append({
      revision: nextRev,
      diffDescription: `Replaced "${flagged}" with "${replacement}" for ${selectedFinding.ruleId}`,
      replacedSpan: flagged,
      newContent: replacement,
      snapshotText: prevText,
    });

    await recordAuditEvent('REWRITE_APPLIED', actorRole, {
      from: sentenceStart,
      to: sentenceStart + flagged.length,
      ruleId: selectedFinding.ruleId,
      previousText: flagged,
      newText: replacement,
    });

    setInspectionState('STALE');
    setSelectedFinding(null);
    setIsInspectorOpenMobile(false);
  };

  // Dismiss finding
  const handleDismissFinding = async (findingId: string) => {
    setDismissedFindingIds((prev) => new Set(prev).add(findingId));
    if (selectedFinding?.id === findingId) {
      setSelectedFinding(null);
      setIsInspectorOpenMobile(false);
    }
    await recordAuditEvent('FINDING_DISMISSED', actorRole, { findingId });
  };

  // Restore dismissed findings
  const handleRestoreDismissed = () => {
    setDismissedFindingIds(new Set());
  };

  // Seal approval fingerprint
  const handleSealFingerprint = async () => {
    if (inspectionState === 'STALE') return;

    // Verify chain integrity before approval
    const chainCheck = await auditChain.verify();
    if (!chainCheck.valid) {
      setIsChainValid(false);
      setChainBreakAt(chainCheck.breakAt);
      return;
    }

    const claimsList: ClaimResult[] = Array.from(claimVerifications.values()).map((c) => ({
      claimId: c.claimId,
      status: c.status,
      sourceFactId: c.sourceFactId,
      exactSourceQuote: c.exactSourceQuote,
      rationale: c.rationale,
      reason: c.reason,
    }));

    const snapshot: InspectionSnapshot = {
      findings: activeFindings,
      claims: claimsList,
      verifierMode: claimVerifications.size > 0 && Array.from(claimVerifications.values()).some((v) => v.mode === 'LIVE')
        ? 'AI_ACTIVE'
        : 'AI_OFFLINE_FALLBACK',
    };

    const approvedAt = new Date().toISOString();
    const payload: ApprovalPayload = {
      draftText: draftContent,
      rulebookVersion: fullRulebookVersion,
      factStoreVersion: fullFactStoreVersion,
      inspectionSnapshot: snapshot,
      actorRole,
      approvedAt,
    };

    const fingerprint = await computeApprovalFingerprint(payload);
    const snapshotHash = await sha256(JSON.stringify(snapshot));

    setSignedDigest(fingerprint);
    setReviewState('APPROVED');
    setLastApprovalPayload(payload);
    setSaveState('SAVED');

    await recordAuditEvent('APPROVED', actorRole, {
      approvalFingerprint: fingerprint,
      snapshotHash,
    });
  };

  const handleRejectDraft = async () => {
    setReviewState('REJECTED');
    setSignedDigest(null);
    await recordAuditEvent('REJECTED', actorRole, {
      previousFingerprint: signedDigest,
      timestamp: new Date().toISOString(),
    });
  };

  const handleOverrideWarning = async (reason: string) => {
    await recordAuditEvent('FINDING_OVERRIDE', actorRole, {
      reason,
      findingId: selectedFinding?.id || 'GLOBAL_OVERRIDE',
      ruleId: selectedFinding?.ruleId || 'WARNING_OVERRIDE',
      timestamp: new Date().toISOString(),
    });
  };

  const handleExportReport = async () => {
    const chainCheck = await auditChain.verify();
    if (!chainCheck.valid) {
      setIsChainValid(false);
      setChainBreakAt(chainCheck.breakAt);
      return;
    }

    const now = new Date().toISOString();
    setReportTimestamp(now);
    await recordAuditEvent('AUDIT_EXPORTED', actorRole, {
      timestamp: now,
    });

    window.print();
  };

  const handleExportWorkspace = () => {
    const jsonStr = createWorkspaceExportEnvelope(
      draftContent,
      revision,
      rules,
      facts,
      events
    );
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brandguard-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportWorkspace = async (file: File) => {
    try {
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        alert('Import failed: malformed JSON format.');
        return;
      }

      const res = importAuditEnvelope(json);
      if (!res.success) {
        if (res.error === 'UNSUPPORTED_SCHEMA_VERSION') {
          alert(`Import rejected: UNSUPPORTED_SCHEMA_VERSION (received: ${res.receivedVersion}, expected: 1).`);
        } else {
          alert(`Import failed: ${res.error}`);
        }
        return;
      }

      if (res.draftText !== undefined) {
        setDraftContent(res.draftText);
        setRevision(res.revision || 1);
        await saveDraftToIndexedDB(res.draftText, res.revision || 1);
      }

      if (res.rules && res.rules.length > 0) {
        await ruleStore.importJSON(JSON.stringify({ rules: res.rules }));
        setRules(ruleStore.list());
        await saveRulesToIndexedDB(ruleStore.list());
        const fv = await ruleStore.getFullVersion();
        setFullRulebookVersion(fv);
      }

      if (res.facts && res.facts.length > 0) {
        factStore.importJSON(JSON.stringify({ facts: res.facts }));
        setFacts(factStore.list());
        await saveFactsToIndexedDB(factStore.list());
        const fv = await factStore.getFullVersion();
        setFullFactStoreVersion(fv);
      }

      if (res.events && res.events.length > 0) {
        setEvents(res.events);
        AuditPersistenceStore.saveEvents(res.events);
        const chain = new AuditChain(res.events);
        const chainCheck = await chain.verify();
        setIsChainValid(chainCheck.valid);
        setChainBreakAt(chainCheck.breakAt);
        const last = res.events[res.events.length - 1];
        setHashChainState(`${last.eventId}_${last.hash.slice(0, 8)}`);

        if (!chainCheck.valid) {
          alert(`Import loaded with warning: Audit chain verification failed at break point EVT-${String(chainCheck.breakAt).padStart(4, '0')}.`);
        }
      }
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const benchContext: BenchContext = {
    inspect,
    verifyClaims,
    recordAuditEvent: (action, role, draftId, text, payload) =>
      auditChain.appendEvent(action, role, draftId, text, payload),
    verifyChain: () => auditChain.verify(),
    computeApprovalFingerprint,
    fullRulebookVersion,
    fullFactStoreVersion,
    actorRole,
  };

  const visibleFindings = activeFindings.filter((f) => !dismissedFindingIds.has(f.id));

  // Rule columns for Brand Rules view
  const ruleColumns: Column<Rule>[] = [
    { header: 'Rule ID', accessor: 'id', isMono: true, className: 'w-24' },
    { header: 'Description', accessor: 'description' },
    { header: 'Category', accessor: 'category', className: 'w-40' },
    {
      header: 'Severity',
      accessor: (row) => (
        <StatusBadge
          status={row.severity === 'VIOLATION' ? 'CONFLICT' : 'UNVERIFIED'}
          customLabel={row.severity}
        />
      ),
      className: 'w-32',
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingRule(row);
              setRuleFormId(row.id);
              setRuleFormDesc(row.description);
              setRuleFormCategory(row.category);
              setRuleFormSeverity(row.severity);
              setRuleFormTerm(
                row.matchingStrategy.type === 'phrase'
                  ? row.matchingStrategy.phrase
                  : row.matchingStrategy.type === 'requiredDisclosure'
                  ? row.matchingStrategy.text
                  : ''
              );
              setRuleFormReplacement(row.explanation || '');
              setIsAddRuleOpen(true);
            }}
            className="text-xs font-mono text-ink-secondary hover:text-ink underline cursor-pointer"
          >
            Edit
          </button>
          <button
            onClick={() => handleDeleteRule(row.id)}
            className="text-xs font-mono text-conflict hover:underline cursor-pointer"
          >
            Delete
          </button>
        </div>
      ),
      className: 'w-28 text-right',
    },
  ];

  // Fact columns for Approved Facts view
  const factColumns: Column<Fact>[] = [
    { header: 'Fact ID', accessor: 'id', isMono: true, className: 'w-24' },
    { header: 'Verified Claim Statement', accessor: 'statement' },
    { header: 'Source', accessor: 'sourceName', className: 'w-48 text-ink-secondary' },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingFact(row);
              setFactFormId(row.id);
              setFactFormStatement(row.statement);
              setFactFormSourceName(row.sourceName);
              setIsAddFactOpen(true);
            }}
            className="text-xs font-mono text-ink-secondary hover:text-ink underline cursor-pointer"
          >
            Edit
          </button>
          <button
            onClick={() => handleDeleteFact(row.id)}
            className="text-xs font-mono text-conflict hover:underline cursor-pointer"
          >
            Delete
          </button>
        </div>
      ),
      className: 'w-28 text-right',
    },
  ];

  if (currentView === 'landing') {
    return (
      <LandingPage
        onLaunchWorkspace={() => setCurrentView('app')}
        onLaunchJudgeBench={() => {
          setCurrentView('app');
          setActiveView('bench');
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-paper text-ink font-sans">
      {/* Hidden print-only DOM container */}
      <div className="hidden print:block fixed inset-0 z-50 bg-surface">
        <AuditReport
          brandId="HydraSerum Labs"
          draftId="DRAFT-01"
          draftText={draftContent}
          schemaVersion={1}
          rulebookVersion={fullRulebookVersion}
          ruleCount={rules.length}
          factStoreVersion={fullFactStoreVersion}
          factCount={facts.length}
          findings={visibleFindings}
          claims={Array.from(claimVerifications.values())}
          approvalFingerprint={signedDigest}
          approvedAt={lastApprovalPayload?.approvedAt || null}
          actorRole={actorRole}
          isApprovalValid={reviewState === 'APPROVED'}
          events={events}
          isChainValid={isChainValid}
          chainBreakAt={chainBreakAt}
          generationTimestamp={reportTimestamp}
        />
      </div>

      {/* 1. Navigation Rail */}
      <NavigationRail
        activeView={activeView}
        onSelectView={(view) => setActiveView(view)}
        rulebookHash={fullRulebookVersion}
        className="hidden md:flex flex-shrink-0 no-print"
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden no-print">
        {/* 2. Top Bar */}
        <TopBar
          activeBrand="HydraSerum Labs"
          draftTitle="Q3 Campaign Copy — Variant A"
          reviewState={reviewState}
          inspectionState={inspectionState}
          saveState={saveState}
          actorRole={actorRole}
          onRoleChange={setActorRole}
          isChainValid={events.length === 0 || isChainValid}
          onExportReport={handleExportReport}
          onExportWorkspace={handleExportWorkspace}
          onImportWorkspace={handleImportWorkspace}
          onLoadPresets={() => setActiveView('bench')}
          onBackToHome={() => setCurrentView('landing')}
        />

        {/* Chain Integrity Alert Banner if Tampered */}
        {events.length > 0 && !isChainValid && (
          <div
            role="alert"
            className="p-2.5 bg-conflict-tint border-b border-conflict-border text-xs font-mono text-conflict flex items-center justify-between"
          >
            <span>Audit integrity: FAILED at EVT-{String(chainBreakAt).padStart(4, '0')}. Export disabled.</span>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'brandguard-audit-events-raw.json';
                a.click();
              }}
              className="underline hover:text-ink cursor-pointer"
            >
              Download raw event log (JSON)
            </button>
          </div>
        )}

        {/* Draft Recovery Notification */}
        {restoredDraftNotice && (
          <div
            role="status"
            className="px-4 py-2 bg-subtle border-b border-muted-border text-xs font-mono text-ink flex items-center justify-between no-print"
          >
            <span>{restoredDraftNotice}</span>
            <button
              onClick={() => setRestoredDraftNotice(null)}
              className="text-xs text-ink-tertiary hover:text-ink underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Storage Corruption Alert */}
        {corruptedStorageDetected && (
          <div
            role="alert"
            className="px-4 py-2 bg-conflict-tint border-b border-conflict-border text-xs font-mono text-conflict flex items-center justify-between no-print"
          >
            <span>Warning: Corrupted record detected in local storage. Invalid data was skipped.</span>
            <button
              onClick={() => setCorruptedStorageDetected(false)}
              className="text-xs underline hover:text-ink cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 3. Primary Working Area by Active View */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {activeView === 'workspace' && (
            <div className="flex-1 flex flex-col lg:flex-row min-w-0 h-full">
              {/* Center Document Editor Canvas */}
              <main
                className="flex-1 flex flex-col p-8 overflow-y-auto bg-[#FAFAFA] min-w-0"
                aria-label="Working Draft Canvas"
              >
                <div className="max-w-4xl w-full mx-auto flex flex-col gap-4">
                  {/* Engine Error Banner */}
                  {engineError && (
                    <div
                      role="alert"
                      className="p-3 bg-red-50 border border-red-200 rounded text-xs font-mono text-red-700"
                    >
                      Engine Error: {engineError}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                    <span className="font-sans font-bold text-xs tracking-wider text-zinc-900 uppercase">
                      Editorial Draft
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      REV #{revision} • TIPTAP ANCHORED
                    </span>
                  </div>

                  {/* TipTap Editor Container */}
                  <EditorPane
                    initialContent={draftContent}
                    onContentChange={handleContentChange}
                    channel={channel}
                    onChannelChange={handleChannelChange}
                    channelLimit={channelLimitChars}
                    onRunAudit={handleRunAudit}
                    isStale={inspectionState === 'STALE'}
                    selectedFinding={selectedFinding}
                    onApplyRewriteRef={applyRewriteRef}
                  />

                  {/* Mobile Findings View (< 768px) */}
                  <div className="block lg:hidden mt-2">
                    <FindingsList
                      findings={visibleFindings}
                      selectedFindingId={selectedFinding?.id || null}
                      onSelectFinding={(f) => {
                        setSelectedFinding(f);
                        setIsInspectorOpenMobile(true);
                      }}
                      onDismissFinding={handleDismissFinding}
                      dismissedCount={dismissedFindingIds.size}
                      onRestoreDismissed={handleRestoreDismissed}
                      isStale={inspectionState === 'STALE'}
                      ruleCount={rules.length}
                      factCount={facts.length}
                      inspectionState={inspectionState}
                    />
                  </div>
                </div>
              </main>

              {/* Right Panel: Diagnostics List + Evidence Inspector */}
              <div className="hidden lg:flex w-96 flex-shrink-0 h-full border-l border-zinc-200 bg-[#F4F4F5] flex-col">
                <div className="h-1/2 p-4 border-b border-zinc-200 overflow-y-auto">
                  <FindingsList
                    findings={visibleFindings}
                    selectedFindingId={selectedFinding?.id || null}
                    onSelectFinding={(f) => setSelectedFinding(f)}
                    onDismissFinding={handleDismissFinding}
                    dismissedCount={dismissedFindingIds.size}
                    onRestoreDismissed={handleRestoreDismissed}
                    isStale={inspectionState === 'STALE'}
                    ruleCount={rules.length}
                    factCount={facts.length}
                    inspectionState={inspectionState}
                  />
                </div>
                <div className="h-1/2 overflow-y-auto bg-white">
                  <EvidenceInspector
                    finding={selectedFinding}
                    claimVerification={selectedFinding ? claimVerifications.get(selectedFinding.id) : null}
                    isStale={inspectionState === 'STALE'}
                    onApplyRewrite={handleApplyRewrite}
                    onDismiss={() => selectedFinding && handleDismissFinding(selectedFinding.id)}
                  />
                </div>
              </div>

              {/* Mobile/Tablet Inspector Drawer */}
              {isInspectorOpenMobile && selectedFinding && (
                <div className="lg:hidden fixed inset-0 z-50 bg-paper/80 flex justify-end">
                  <div className="w-full max-w-md h-full bg-surface border-l border-strong-border shadow-md">
                    <EvidenceInspector
                      finding={selectedFinding}
                      claimVerification={selectedFinding ? claimVerifications.get(selectedFinding.id) : null}
                      isStale={inspectionState === 'STALE'}
                      onApplyRewrite={handleApplyRewrite}
                      onDismiss={() => {
                        handleDismissFinding(selectedFinding.id);
                        setIsInspectorOpenMobile(false);
                      }}
                      onClose={() => setIsInspectorOpenMobile(false)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'rules' && (
            <main className="flex-1 p-6 overflow-y-auto bg-paper">
              <div className="max-w-4xl mx-auto flex flex-col gap-4">
                <div className="border-b border-muted-border pb-2 flex items-center justify-between">
                  <div>
                    <h1 className="font-serif font-bold text-base text-ink uppercase tracking-wide">
                      Brand Rulebook
                    </h1>
                    <p className="text-xs text-ink-secondary mt-1">
                      Deterministic compliance patterns. Rulebook Version: <span className="font-mono text-ink font-semibold">{fullRulebookVersion.slice(0, 12)}</span>
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingRule(null);
                      setRuleFormId(`RULE-${String(rules.length + 1).padStart(2, '0')}`);
                      setRuleFormDesc('');
                      setRuleFormCategory('BANNED_PHRASE');
                      setRuleFormSeverity('VIOLATION');
                      setRuleFormTerm('');
                      setRuleFormReplacement('');
                      setIsAddRuleOpen(true);
                    }}
                  >
                    + Add Rule
                  </Button>
                </div>

                {/* Inline Add / Edit Rule Form */}
                {isAddRuleOpen && (
                  <div className="p-4 bg-surface border border-strong-border rounded-xs flex flex-col gap-3 font-mono text-xs">
                    <div className="font-sans font-bold text-ink">
                      {editingRule ? `Edit Rule: ${editingRule.id}` : 'Create New Brand Rule'}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-ink-secondary text-[11px]">Rule ID</span>
                        <input
                          type="text"
                          value={ruleFormId}
                          disabled={Boolean(editingRule)}
                          onChange={(e) => setRuleFormId(e.target.value)}
                          className="p-1.5 border border-muted-border bg-paper text-ink rounded-xs font-mono"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-ink-secondary text-[11px]">Category</span>
                        <select
                          value={ruleFormCategory}
                          onChange={(e) => {
                            const cat = e.target.value as Rule['category'];
                            setRuleFormCategory(cat);
                            if (cat === 'DISCOURAGED_TERM') setRuleFormSeverity('NOTICE');
                            else setRuleFormSeverity('VIOLATION');
                          }}
                          className="p-1.5 border border-muted-border bg-paper text-ink rounded-xs font-mono"
                        >
                          <option value="BANNED_PHRASE">BANNED_PHRASE</option>
                          <option value="DISCOURAGED_TERM">DISCOURAGED_TERM</option>
                          <option value="REQUIRED_DISCLAIMER">REQUIRED_DISCLAIMER</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-ink-secondary text-[11px]">Severity</span>
                        <select
                          value={ruleFormSeverity}
                          onChange={(e) => setRuleFormSeverity(e.target.value as Rule['severity'])}
                          className="p-1.5 border border-muted-border bg-paper text-ink rounded-xs font-mono"
                        >
                          <option value="VIOLATION">VIOLATION</option>
                          <option value="NOTICE">NOTICE</option>
                        </select>
                      </label>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-ink-secondary text-[11px]">Description</span>
                      <input
                        type="text"
                        value={ruleFormDesc}
                        onChange={(e) => setRuleFormDesc(e.target.value)}
                        placeholder="e.g. Prohibit unproven medical efficacy claim"
                        className="p-1.5 border border-muted-border bg-paper text-ink rounded-xs font-sans text-xs"
                      />
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-ink-secondary text-[11px]">Match Pattern / Prohibited Term</span>
                        <input
                          type="text"
                          value={ruleFormTerm}
                          onChange={(e) => setRuleFormTerm(e.target.value)}
                          placeholder="e.g. miracle"
                          className="p-1.5 border border-muted-border bg-paper text-ink rounded-xs font-mono"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-ink-secondary text-[11px]">Suggested Replacement (optional)</span>
                        <input
                          type="text"
                          value={ruleFormReplacement}
                          onChange={(e) => setRuleFormReplacement(e.target.value)}
                          placeholder="e.g. clinically tested"
                          className="p-1.5 border border-muted-border bg-paper text-ink rounded-xs font-mono"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setIsAddRuleOpen(false);
                          setEditingRule(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleSaveRule}>
                        Save Rule
                      </Button>
                    </div>
                  </div>
                )}

                <DataTable<Rule>
                  columns={ruleColumns}
                  data={rules}
                  keyExtractor={(row) => row.id}
                  emptyMessage="Rulebook contains 0 rules."
                />
              </div>
            </main>
          )}

          {activeView === 'facts' && (
            <main className="flex-1 p-6 overflow-y-auto bg-paper">
              <div className="max-w-4xl mx-auto flex flex-col gap-4">
                <div className="border-b border-muted-border pb-2 flex items-center justify-between">
                  <div>
                    <h1 className="font-serif font-bold text-base text-ink uppercase tracking-wide">
                      Approved Product Facts
                    </h1>
                    <p className="text-xs text-ink-secondary mt-1">
                      Verifiable ground-truth facts. Fact Store Version: <span className="font-mono text-ink font-semibold">{fullFactStoreVersion.slice(0, 12)}</span>
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditingFact(null);
                      setFactFormId(`FACT-${String(facts.length + 1).padStart(2, '0')}`);
                      setFactFormStatement('');
                      setFactFormSourceName('');
                      setIsAddFactOpen(true);
                    }}
                  >
                    + Add Fact
                  </Button>
                </div>

                {/* Inline Add / Edit Fact Form */}
                {isAddFactOpen && (
                  <div className="p-4 bg-surface border border-strong-border rounded-xs flex flex-col gap-3 font-mono text-xs">
                    <div className="font-sans font-bold text-ink">
                      {editingFact ? `Edit Fact: ${editingFact.id}` : 'Create New Approved Fact'}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-ink-secondary text-[11px]">Fact ID</span>
                        <input
                          type="text"
                          value={factFormId}
                          disabled={Boolean(editingFact)}
                          onChange={(e) => setFactFormId(e.target.value)}
                          className="p-1.5 border border-muted-border bg-paper text-ink rounded-xs font-mono"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-ink-secondary text-[11px]">Source Name</span>
                        <input
                          type="text"
                          value={factFormSourceName}
                          onChange={(e) => setFactFormSourceName(e.target.value)}
                          placeholder="e.g. Clinical Study 2024-B"
                          className="p-1.5 border border-muted-border bg-paper text-ink rounded-xs font-mono"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-ink-secondary text-[11px]">Verified Claim Statement</span>
                      <textarea
                        rows={3}
                        value={factFormStatement}
                        onChange={(e) => setFactFormStatement(e.target.value)}
                        placeholder="e.g. HydraSerum reduces visible wrinkles by up to 28% after 8 weeks."
                        className="p-1.5 border border-muted-border bg-paper text-ink rounded-xs font-sans text-xs"
                      />
                    </label>
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setIsAddFactOpen(false);
                          setEditingFact(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleSaveFact}>
                        Save Fact
                      </Button>
                    </div>
                  </div>
                )}

                <DataTable<Fact>
                  columns={factColumns}
                  data={facts}
                  keyExtractor={(row) => row.id}
                  emptyMessage="Fact registry contains 0 facts."
                />
              </div>
            </main>
          )}

          {activeView === 'history' && (
            <main className="flex-1 p-6 overflow-y-auto bg-paper">
              <div className="max-w-4xl mx-auto flex flex-col gap-4">
                <div className="border-b border-muted-border pb-2">
                  <h1 className="font-serif font-bold text-base text-ink uppercase tracking-wide">
                    Audit Event Chain & Revision Log
                  </h1>
                  <p className="text-xs text-ink-secondary mt-1">
                    Cryptographic audit trail tracking all governance evaluations, rewrites, and sealed fingerprints.
                  </p>
                </div>
                {events.length === 0 ? (
                  <div className="p-8 border border-muted-border bg-surface text-center text-xs text-ink-tertiary font-mono">
                    [AUDIT_CHAIN_EMPTY: NO_EVENTS_LOGGED_YET]
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 font-mono text-xs">
                    {events.map((evt) => (
                      <div
                        key={evt.eventId}
                        className="p-3 bg-surface border border-muted-border rounded-xs flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                          <span className="font-bold text-ink">{evt.eventId} • {evt.action}</span>
                          <span>{evt.timestamp}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-ink-tertiary">
                          <span>ROLE: {evt.actorRole}</span>
                          <span>PREV: {evt.prevHash.slice(0, 10)}…</span>
                          <span className="text-ink font-semibold">HASH: {evt.hash.slice(0, 12)}…</span>
                        </div>
                        {Boolean(evt.payload) && (
                          <pre className="p-2 bg-paper border border-muted-border rounded-xs text-[10px] whitespace-pre-wrap overflow-x-auto text-ink-secondary mt-1">
                            {JSON.stringify(evt.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </main>
          )}

          {activeView === 'insights' && (
            <InsightsView events={events} />
          )}

          {activeView === 'bench' && (
            <JudgeBench benchContext={benchContext} />
          )}
        </div>

        {/* 4. Compact Audit Status Region */}
        <AuditStatusRegion
          reviewState={reviewState}
          signedDigest={signedDigest}
          hashChainState={hashChainState}
          onApprove={handleSealFingerprint}
          onReject={handleRejectDraft}
          onOverride={handleOverrideWarning}
          isStale={inspectionState === 'STALE'}
        />

        {/* 5. Persistent Confidentiality Footer (§3) */}
        <footer className="h-6 px-4 bg-[#09090B] border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-400 no-print select-none">
          <span>All data is stored locally in this browser. Nothing is synced to a server. Export regularly.</span>
          <span>IndexedDB Persistence • Zero Telemetry</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
