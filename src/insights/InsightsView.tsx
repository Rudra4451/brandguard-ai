import React from 'react';
import { AuditPersistenceStore } from '../storage/db';
import type { AuditEvent, AuditAction } from '../engine/audit-chain';

interface InsightsViewProps {
  events?: readonly AuditEvent[];
  className?: string;
}

export const InsightsView: React.FC<InsightsViewProps> = ({ events: propEvents, className = '' }) => {
  const events = propEvents || AuditPersistenceStore.loadEvents();

  if (!events || events.length === 0) {
    return (
      <main className={`flex-1 p-6 overflow-y-auto bg-paper text-ink ${className}`}>
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          <div className="border-b border-muted-border pb-2">
            <h1 className="font-serif font-bold text-base text-ink uppercase tracking-wide">
              Compliance Insights
            </h1>
            <p className="text-xs text-ink-secondary mt-1">
              Historical compliance analysis derived strictly from recorded audit events.
            </p>
          </div>
          <div className="p-8 border border-muted-border bg-surface text-center text-xs text-ink-tertiary font-mono rounded-xs">
            No audit history yet. Insights appear after the first review cycle.
          </div>
        </div>
      </main>
    );
  }

  const totalEvents = events.length;

  // A. Event counts by action
  const actionCounts: Record<AuditAction, number> = {
    DRAFT_CREATED: 0,
    AUDIT_RUN: 0,
    REWRITE_APPLIED: 0,
    FINDING_DISMISSED: 0,
    FINDING_OVERRIDE: 0,
    APPROVED: 0,
    REJECTED: 0,
    APPROVAL_INVALIDATED: 0,
    AUDIT_EXPORTED: 0,
  };

  for (const evt of events) {
    if (evt.action in actionCounts) {
      actionCounts[evt.action as AuditAction]++;
    }
  }

  const auditRunEvents = events.filter((e) => e.action === 'AUDIT_RUN');
  const auditRunsCount = auditRunEvents.length;

  // B. Common finding categories
  const categoriesCountMap: Record<string, number> = {};
  for (const evt of auditRunEvents) {
    const payload = evt.payload as Record<string, unknown> | null;
    if (payload && typeof payload === 'object' && Array.isArray((payload as any).categories)) {
      for (const cat of (payload as any).categories) {
        categoriesCountMap[cat] = (categoriesCountMap[cat] || 0) + 1;
      }
    }
  }
  const categoryEntries = Object.entries(categoriesCountMap).sort((a, b) => b[1] - a[1]);

  // C. Frequently overridden rules
  const overrideEvents = events.filter((e) => e.action === 'FINDING_OVERRIDE');
  const totalOverrides = overrideEvents.length;
  const ruleOverrideMap: Record<string, number> = {};
  for (const evt of overrideEvents) {
    const payload = evt.payload as Record<string, unknown> | null;
    const ruleId = (payload?.ruleId as string) || (payload?.findingId as string) || 'UNKNOWN_RULE';
    ruleOverrideMap[ruleId] = (ruleOverrideMap[ruleId] || 0) + 1;
  }
  const frequentOverrides = Object.entries(ruleOverrideMap).filter(([, count]) => count >= 2);

  // D. Approval outcomes
  const approvedCount = actionCounts.APPROVED;
  const rejectedCount = actionCounts.REJECTED;
  const invalidatedCount = actionCounts.APPROVAL_INVALIDATED;

  // E. Rule friction (findings with >= 5 occurrences)
  // Track overrides, dismissals, and upholds per rule
  const ruleFindingCounts: Record<string, { total: number; overridden: number; dismissed: number; upheld: number }> = {};
  for (const evt of events) {
    if (evt.action === 'FINDING_OVERRIDE') {
      const payload = evt.payload as Record<string, unknown> | null;
      const ruleId = (payload?.ruleId as string) || (payload?.findingId as string) || 'RULE-UNKNOWN';
      if (!ruleFindingCounts[ruleId]) ruleFindingCounts[ruleId] = { total: 0, overridden: 0, dismissed: 0, upheld: 0 };
      ruleFindingCounts[ruleId].total++;
      ruleFindingCounts[ruleId].overridden++;
    } else if (evt.action === 'FINDING_DISMISSED') {
      const payload = evt.payload as Record<string, unknown> | null;
      const ruleId = (payload?.ruleId as string) || (payload?.findingId as string) || 'RULE-UNKNOWN';
      if (!ruleFindingCounts[ruleId]) ruleFindingCounts[ruleId] = { total: 0, overridden: 0, dismissed: 0, upheld: 0 };
      ruleFindingCounts[ruleId].total++;
      ruleFindingCounts[ruleId].dismissed++;
    }
  }
  const highFrictionRules = Object.entries(ruleFindingCounts).filter(([, counts]) => counts.total >= 5);

  return (
    <main className={`flex-1 p-6 overflow-y-auto bg-paper text-ink ${className}`}>
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="border-b border-muted-border pb-3">
          <h1 className="font-serif font-bold text-base text-ink uppercase tracking-wide">
            Compliance Insights
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            Historical audit metrics computed strictly from the cryptographic audit event ledger. No external telemetry.
          </p>
        </div>

        {/* Section A: Event counts (always renderable) */}
        <section className="p-4 bg-surface border border-muted-border rounded-xs flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-muted-border pb-2">
            <h2 className="font-serif font-bold text-xs uppercase tracking-wider text-ink">
              A. Recorded Audit Event Counts
            </h2>
            <span className="font-mono text-xs font-semibold text-ink">
              Total Events: {totalEvents}
            </span>
          </div>
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-paper border-b border-muted-border text-ink-tertiary text-[10px] uppercase">
                <th className="p-2">Action Name</th>
                <th className="p-2">Event Count</th>
                <th className="p-2">Proportion with Explicit Denominator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-border">
              {(Object.keys(actionCounts) as AuditAction[]).map((action) => {
                const count = actionCounts[action];
                const pct = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
                return (
                  <tr key={action}>
                    <td className="p-2 font-semibold text-ink">{action}</td>
                    <td className="p-2">{count}</td>
                    <td className="p-2 text-ink-secondary">
                      {count} of {totalEvents} total events ({pct}%)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Section B: Common finding categories */}
        <section className="p-4 bg-surface border border-muted-border rounded-xs flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-muted-border pb-2">
            <h2 className="font-serif font-bold text-xs uppercase tracking-wider text-ink">
              B. Common Finding Categories
            </h2>
            <span className="font-mono text-[10px] text-ink-tertiary">
              Audit Runs: {auditRunsCount} (Threshold: ≥ 3)
            </span>
          </div>
          {auditRunsCount < 3 ? (
            <div className="p-4 bg-paper border border-muted-border rounded-xs text-xs text-ink-tertiary font-mono text-center">
              Not enough audit history to show category trends ({auditRunsCount} of 3 required).
            </div>
          ) : categoryEntries.length === 0 ? (
            <div className="p-4 bg-paper border border-muted-border rounded-xs text-xs text-ink-secondary font-mono text-center">
              Zero findings categories recorded across {auditRunsCount} audit runs.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-paper border-b border-muted-border text-ink-tertiary text-[10px] uppercase">
                  <th className="p-2">Category</th>
                  <th className="p-2">Occurrences</th>
                  <th className="p-2">Proportion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-border">
                {categoryEntries.map(([cat, count]) => (
                  <tr key={cat}>
                    <td className="p-2 font-semibold text-ink">{cat}</td>
                    <td className="p-2">{count}</td>
                    <td className="p-2 text-ink-secondary">
                      {count} observed across {auditRunsCount} audit runs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Section C: Frequently overridden rules */}
        <section className="p-4 bg-surface border border-muted-border rounded-xs flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-muted-border pb-2">
            <h2 className="font-serif font-bold text-xs uppercase tracking-wider text-ink">
              C. Frequently Overridden Rules
            </h2>
            <span className="font-mono text-[10px] text-ink-tertiary">
              Overrides: {totalOverrides} (Threshold: ≥ 5)
            </span>
          </div>
          {totalOverrides < 5 ? (
            <div className="p-4 bg-paper border border-muted-border rounded-xs text-xs text-ink-tertiary font-mono text-center">
              Not enough override history to evaluate rule exceptions ({totalOverrides} of 5 required).
            </div>
          ) : frequentOverrides.length === 0 ? (
            <div className="p-4 bg-paper border border-muted-border rounded-xs text-xs text-ink-secondary font-mono text-center">
              No individual rule has reached the threshold of ≥ 2 overrides out of {totalOverrides} total overrides.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-paper border-b border-muted-border text-ink-tertiary text-[10px] uppercase">
                  <th className="p-2">Rule ID</th>
                  <th className="p-2">Override Count</th>
                  <th className="p-2">Proportion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-border">
                {frequentOverrides.map(([ruleId, count]) => (
                  <tr key={ruleId}>
                    <td className="p-2 font-semibold text-ink">{ruleId}</td>
                    <td className="p-2">{count}</td>
                    <td className="p-2 text-ink-secondary">
                      {count} overrides out of {totalOverrides} total overrides
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Section D: Approval outcomes */}
        <section className="p-4 bg-surface border border-muted-border rounded-xs flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-muted-border pb-2">
            <h2 className="font-serif font-bold text-xs uppercase tracking-wider text-ink">
              D. Review & Approval Outcomes
            </h2>
            <span className="font-mono text-[10px] text-ink-tertiary">
              Audit Runs: {auditRunsCount}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-paper border border-muted-border rounded-xs flex flex-col gap-1 font-mono">
              <span className="text-[10px] uppercase text-ink-tertiary">Approved Seals</span>
              <span className="text-sm font-bold text-ink">{approvedCount}</span>
              <span className="text-[10px] text-ink-secondary">
                {auditRunsCount > 0
                  ? `${approvedCount} approvals out of ${auditRunsCount} audit runs (${Math.round((approvedCount / auditRunsCount) * 100)}%)`
                  : `${approvedCount} approvals out of 0 audit runs`}
              </span>
            </div>

            <div className="p-3 bg-paper border border-muted-border rounded-xs flex flex-col gap-1 font-mono">
              <span className="text-[10px] uppercase text-ink-tertiary">Rejected Decisions</span>
              <span className="text-sm font-bold text-ink">{rejectedCount}</span>
              <span className="text-[10px] text-ink-secondary">
                {auditRunsCount > 0
                  ? `${rejectedCount} rejections out of ${auditRunsCount} audit runs (${Math.round((rejectedCount / auditRunsCount) * 100)}%)`
                  : `${rejectedCount} rejections out of 0 audit runs`}
              </span>
            </div>

            <div className="p-3 bg-paper border border-muted-border rounded-xs flex flex-col gap-1 font-mono">
              <span className="text-[10px] uppercase text-ink-tertiary">Approval Invalidations</span>
              <span className="text-sm font-bold text-ink">{invalidatedCount}</span>
              <span className="text-[10px] text-ink-secondary">
                {approvedCount > 0
                  ? `${invalidatedCount} invalidations out of ${approvedCount} approvals (${Math.round((invalidatedCount / approvedCount) * 100)}%)`
                  : `${invalidatedCount} invalidations out of 0 approvals`}
              </span>
            </div>
          </div>
        </section>

        {/* Section E: Rule friction */}
        <section className="p-4 bg-surface border border-muted-border rounded-xs flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-muted-border pb-2">
            <h2 className="font-serif font-bold text-xs uppercase tracking-wider text-ink">
              E. Rule Friction Analysis
            </h2>
            <span className="font-mono text-[10px] text-ink-tertiary">
              Threshold: ≥ 5 findings per rule
            </span>
          </div>
          {highFrictionRules.length === 0 ? (
            <div className="p-4 bg-paper border border-muted-border rounded-xs text-xs text-ink-tertiary font-mono text-center">
              No rules have reached the minimum 5 recorded findings threshold for friction analysis.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-paper border-b border-muted-border text-ink-tertiary text-[10px] uppercase">
                  <th className="p-2">Rule ID</th>
                  <th className="p-2">Total Scrutinized</th>
                  <th className="p-2">Raw Disposition Counts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-border">
                {highFrictionRules.map(([ruleId, c]) => (
                  <tr key={ruleId}>
                    <td className="p-2 font-semibold text-ink">{ruleId}</td>
                    <td className="p-2">{c.total} findings</td>
                    <td className="p-2 text-ink-secondary">
                      {c.overridden} overridden, {c.dismissed} dismissed, {c.upheld} upheld
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
};
