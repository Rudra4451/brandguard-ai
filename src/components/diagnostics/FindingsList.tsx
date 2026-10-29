import React from 'react';
import { FindingCard } from './FindingCard';
import type { Finding } from '../../engine/types';

interface FindingsListProps {
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (finding: Finding) => void;
  onDismissFinding: (findingId: string) => void;
  dismissedCount: number;
  onRestoreDismissed: () => void;
  isStale: boolean;
  ruleCount: number;
  factCount: number;
  inspectionState?: 'UNAUDITED' | 'INSPECTED' | 'STALE';
}

export const FindingsList: React.FC<FindingsListProps> = ({
  findings,
  selectedFindingId,
  onSelectFinding,
  onDismissFinding,
  dismissedCount,
  onRestoreDismissed,
  isStale,
  ruleCount,
  factCount,
  inspectionState,
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Persistent Staleness Banner */}
      {isStale && (
        <div
          role="status"
          className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs font-mono text-amber-900 flex items-center justify-between"
        >
          <span>Findings stale — re-run audit</span>
        </div>
      )}

      {/* Header and Dismissed Count Restore */}
      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <span className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-900">
            Findings
          </span>
          <span
            aria-live="polite"
            className="px-1.5 py-0.5 font-mono text-[10px] bg-zinc-200 text-zinc-800 rounded font-semibold"
          >
            {findings.length}
          </span>
        </div>

        {dismissedCount > 0 && (
          <button
            type="button"
            onClick={onRestoreDismissed}
            aria-label={`Restore ${dismissedCount} dismissed findings`}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-900 cursor-pointer transition-colors"
          >
            Restore dismissed ({dismissedCount})
          </button>
        )}
      </div>

      {/* Empty State: Awaiting Inspection if UNAUDITED */}
      {findings.length === 0 && inspectionState === 'UNAUDITED' && (
        <div className="p-8 bg-white border border-zinc-200 rounded text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-sans font-bold text-zinc-900">Awaiting Inspection</h4>
            <p className="mt-1 text-xs text-zinc-500 font-sans">
              Run Governance Audit to inspect this draft.
            </p>
          </div>
        </div>
      )}

      {/* Empty State: 0 Issues Found if INSPECTED / STALE */}
      {findings.length === 0 && inspectionState !== 'UNAUDITED' && (
        <div className="p-8 bg-white border border-zinc-200 rounded text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-sans font-bold text-zinc-900">0 Issues Found</h4>
            <p className="mt-1 text-xs text-zinc-500 font-sans">
              Draft satisfies all {ruleCount} active brand rules and verified against {factCount} approved facts.
            </p>
          </div>
        </div>
      )}

      {/* Findings List */}
      <div className="flex flex-col gap-2">
        {findings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            isSelected={selectedFindingId === finding.id}
            onSelect={() => onSelectFinding(finding)}
            onDismiss={() => onDismissFinding(finding.id)}
          />
        ))}
      </div>
    </div>
  );
};
