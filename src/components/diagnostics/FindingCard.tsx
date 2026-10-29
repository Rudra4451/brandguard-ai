import React from 'react';
import { StatusBadge } from '../primitives/StatusBadge';
import type { Finding } from '../../engine/types';

interface FindingCardProps {
  finding: Finding;
  isSelected: boolean;
  onSelect: () => void;
  onDismiss: () => void;
}

export const FindingCard: React.FC<FindingCardProps> = ({
  finding,
  isSelected,
  onSelect,
  onDismiss,
}) => {
  const isCandidate = finding.category === 'CLAIM_CANDIDATE';
  const label = isCandidate
    ? 'CLAIM_CANDIDATE'
    : finding.severity === 'VIOLATION'
    ? 'VIOLATION'
    : 'NOTICE';

  const accessibleName = `${label} ${finding.ruleId} ${finding.flaggedText || ''}`;

  const leftBorderColor =
    finding.severity === 'VIOLATION'
      ? 'border-l-red-500'
      : isCandidate
      ? 'border-l-amber-500'
      : 'border-l-blue-500';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={accessibleName}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`p-3 rounded bg-white border border-zinc-200 border-l-4 ${leftBorderColor} text-left transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-blue-600 shadow-xs ${
        isSelected
          ? 'ring-2 ring-zinc-800 bg-zinc-50/80'
          : 'hover:bg-zinc-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge
            status={
              isCandidate
                ? 'UNVERIFIED'
                : finding.severity === 'VIOLATION'
                ? 'CONFLICT'
                : 'UNVERIFIED'
            }
            customLabel={finding.ruleId}
          />
          <span
            className={`px-1.5 py-0.5 font-mono text-[9px] uppercase font-semibold rounded border ${
              isCandidate
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-zinc-100 text-zinc-600 border-zinc-200'
            }`}
          >
            {isCandidate ? 'AI-ASSISTED' : 'RULE ENGINE'}
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            {finding.sentenceId}:{finding.startOffset}–{finding.endOffset}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="text-zinc-400 hover:text-zinc-800 text-xs px-1.5 py-0.5 rounded hover:bg-zinc-100 focus-visible:outline-1 cursor-pointer transition-colors"
          title="Dismiss finding (reversible)"
          aria-label={`Dismiss finding ${finding.id}`}
        >
          Dismiss
        </button>
      </div>

      <div className="mt-2 text-xs font-mono text-zinc-900 bg-zinc-50 px-2 py-1 rounded border border-zinc-200/60 truncate">
        "{finding.flaggedText || finding.candidateText || finding.ruleId}"
      </div>

      <p className="mt-1.5 text-xs text-zinc-600 leading-relaxed font-sans line-clamp-2">
        {finding.explanation}
      </p>
    </div>
  );
};
