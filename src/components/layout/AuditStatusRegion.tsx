import React, { useState } from 'react';
import { IconLock, IconBrokenLink } from '../primitives/Icons';
import type { ReviewState } from './TopBar';

interface AuditStatusRegionProps {
  reviewState: ReviewState;
  signedDigest: string | null;
  hashChainState: string;
  onApprove: () => void;
  onReject?: () => void;
  onOverride?: (reason: string) => void;
  isStale: boolean;
  className?: string;
}

export const AuditStatusRegion: React.FC<AuditStatusRegionProps> = ({
  reviewState,
  signedDigest,
  hashChainState,
  onApprove,
  onReject,
  onOverride,
  isStale,
  className = '',
}) => {
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const isApproved = reviewState === 'APPROVED';
  const isRejected = reviewState === 'REJECTED';
  const isInvalidated = reviewState === 'RE_REVIEW_REQUESTED';

  const handleConfirmOverride = () => {
    if (!overrideReason.trim()) return;
    if (onOverride) {
      onOverride(overrideReason.trim());
    }
    setOverrideReason('');
    setIsOverrideModalOpen(false);
  };

  return (
    <>
      <footer
        className={`px-4 py-2 border-t border-zinc-200 bg-white flex items-center justify-between gap-4 select-none ${className}`}
      >
        <div className="flex items-center gap-6 overflow-x-auto">
          {/* SHA-256 Fingerprint Indicator */}
          <div className="flex items-center gap-2">
            <IconLock className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <div className="flex flex-col">
              <span
                className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 cursor-help"
                title="A fingerprint is a SHA-256 hash of the draft, rulebook, and facts. It proves the reviewed content has not changed since approval. It is not a cryptographic signature."
              >
                Sealed Fingerprint (SHA-256)
              </span>
              <span
                className={`font-mono text-xs ${
                  isInvalidated
                    ? 'line-through text-red-600'
                    : isRejected
                    ? 'text-red-500 font-semibold'
                    : signedDigest
                    ? 'text-zinc-900 font-semibold'
                    : 'text-zinc-400 italic'
                }`}
              >
                {isRejected
                  ? 'REJECTED'
                  : signedDigest
                  ? signedDigest.slice(0, 12) + '…'
                  : 'NOT_SEALED'}
              </span>
            </div>
          </div>

          {/* Chained Ledger State */}
          <div className="flex flex-col">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">
              Audit Event Hash-Chain
            </span>
            <span className="font-mono text-xs text-zinc-800 font-semibold">
              {hashChainState}
            </span>
          </div>

          {/* Invalidation Warning Notice */}
          {isInvalidated && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs font-mono font-medium">
              <IconBrokenLink className="w-3.5 h-3.5 flex-shrink-0" />
              <span>FINGERPRINT_INVALIDATED: GROUNDS_CHANGED</span>
            </div>
          )}

          {/* Rejected Status Notice */}
          {isRejected && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-300 text-xs font-mono font-medium">
              <span>DECISION: DRAFT_REJECTED</span>
            </div>
          )}
        </div>

        {/* Action button cluster: Override, Reject, Seal */}
        <div className="flex items-center gap-2">
          {onOverride && (
            <button
              type="button"
              onClick={() => setIsOverrideModalOpen(true)}
              title="Record a justified compliance override"
              className="px-3 py-1.5 text-xs font-sans font-medium rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors cursor-pointer"
            >
              Override Warning
            </button>
          )}

          {onReject && (
            <button
              type="button"
              onClick={onReject}
              disabled={isRejected}
              title="Reject draft and record rejection event"
              className="px-3 py-1.5 text-xs font-sans font-medium rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Reject Draft
            </button>
          )}

          <button
            type="button"
            onClick={onApprove}
            disabled={isStale}
            title={isStale ? 'Re-run audit before approving.' : 'Seal fingerprint (SHA-256 attested)'}
            className={`px-3 py-1.5 text-xs font-sans font-semibold rounded transition-colors cursor-pointer disabled:cursor-not-allowed ${
              isApproved
                ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white disabled:bg-zinc-200 disabled:text-zinc-400'
            }`}
          >
            {isApproved ? 'Re-Seal Fingerprint' : 'Seal Fingerprint'}
          </button>
        </div>
      </footer>

      {/* Override Warning Modal */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-300 rounded-md shadow-2xl max-w-md w-full p-5 flex flex-col gap-3 font-sans">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
              <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                Override Warning Justification
              </h3>
              <button
                onClick={() => setIsOverrideModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-mono"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Compliance standards require a mandatory recorded reason to override an audit finding or disclaimer warning. This rationale will be permanently recorded into the SHA-256 audit ledger.
            </p>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Approved by legal counsel under exemption ref #L-2026-88."
              className="p-2 border border-zinc-300 rounded text-xs font-mono text-zinc-900 bg-zinc-50 focus:bg-white focus:outline-blue-600 focus:border-blue-600"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-200">
              <button
                type="button"
                onClick={() => {
                  setOverrideReason('');
                  setIsOverrideModalOpen(false);
                }}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded border border-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!overrideReason.trim()}
                onClick={handleConfirmOverride}
                className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded transition-colors"
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
