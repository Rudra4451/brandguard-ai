import React, { useState } from 'react';
import { StatusBadge } from '../primitives/StatusBadge';
import { Button } from '../primitives/Button';
import { TextInput } from '../primitives/TextInput';
import type { Finding } from '../../engine/types';
import type { ClaimVerification } from '../../engine/claim-verifier';

interface EvidenceInspectorProps {
  finding: Finding | null;
  claimVerification?: ClaimVerification | null;
  isStale: boolean;
  onApplyRewrite?: (replacement: string) => void;
  onDismiss?: () => void;
  onClose?: () => void;
  className?: string;
}

export const EvidenceInspector: React.FC<EvidenceInspectorProps> = ({
  finding,
  claimVerification,
  isStale,
  onApplyRewrite,
  onDismiss,
  onClose,
  className = '',
}) => {
  const [isEditingCorrection, setIsEditingCorrection] = useState(false);
  const [editedCorrection, setEditedCorrection] = useState('');

  if (!finding) {
    return (
      <aside
        className={`w-full h-full p-6 flex flex-col items-center justify-center text-center bg-white border-l border-zinc-200 ${className}`}
        aria-label="Evidence Inspector"
      >
        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <span className="text-xs font-mono font-medium text-zinc-400 uppercase tracking-wider">Awaiting Selection</span>
        <p className="mt-1.5 text-xs text-zinc-500 max-w-[220px] font-sans leading-relaxed">
          Select an annotated finding from the diagnostics list to scrutinize authorities and evidence.
        </p>
      </aside>
    );
  }

  const isCandidate = finding.category === 'CLAIM_CANDIDATE';

  // Resolve status for candidate from real verifier
  const candidateStatus = claimVerification?.status || 'UNVERIFIED';
  const candidateReason = claimVerification?.reason || 'AI_OFFLINE_FALLBACK';
  const isConflict = candidateStatus === 'CONFLICT_FOUND';
  const isSupported = candidateStatus === 'SUPPORTED';
  const isOffline = candidateReason === 'AI_OFFLINE_FALLBACK' || claimVerification?.mode === 'OFFLINE_FALLBACK';

  const effectiveCorrection =
    finding.suggestedCorrection ||
    (claimVerification as any)?.prescriptiveRewrite ||
    (finding as any)?.prescriptiveRewrite ||
    (isCandidate && isConflict && claimVerification?.exactSourceQuote
      ? claimVerification.exactSourceQuote
      : undefined);
  const hasSuggestedCorrection = Boolean(effectiveCorrection);

  return (
    <aside
      className={`w-full h-full flex flex-col bg-surface border-l border-muted-border overflow-y-auto ${className}`}
      aria-label="Evidence Inspector"
    >
      {/* Header bar */}
      <div className="p-3 border-b border-muted-border bg-subtle flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge
              status={
                isCandidate
                  ? isSupported
                    ? 'SUPPORTED'
                    : isConflict
                    ? 'CONFLICT'
                    : 'UNVERIFIED'
                  : finding.severity === 'VIOLATION'
                  ? 'CONFLICT'
                  : 'UNVERIFIED'
              }
              customLabel={
                isCandidate
                  ? candidateStatus
                  : finding.severity === 'VIOLATION'
                  ? 'VIOLATION'
                  : 'NOTICE'
              }
            />
            <span className="font-mono text-xs font-semibold text-ink">
              {finding.category}
            </span>
            <span
              className={`px-1.5 py-0.2 font-mono text-[9px] uppercase font-semibold rounded-xs border ${
                isCandidate
                  ? 'bg-deterministic-tint text-deterministic border-deterministic-border'
                  : 'bg-subtle text-ink-secondary border-muted-border'
              }`}
            >
              {isCandidate ? 'AI-ASSISTED (GEMINI 2.5 FLASH)' : 'RULE ENGINE'}
            </span>
          </div>
          {onClose && (
            <Button variant="subtle" size="sm" onClick={onClose} aria-label="Close inspector">
              ✕
            </Button>
          )}
        </div>

        {/* Verifier Scope Notice */}
        <span className="text-[10px] font-sans text-ink-tertiary">
          Verified against approved facts only. Not open-web research.
        </span>
      </div>

      {/* Staleness Notice in Inspector */}
      {isStale && (
        <div className="p-2.5 bg-unverified-tint border-b border-unverified-border text-xs font-mono text-unverified text-center">
          Findings stale — re-run audit
        </div>
      )}

      {/* Offline Mode Banner */}
      {isCandidate && isOffline && (
        <div className="p-2.5 bg-subtle border-b border-strong-border text-xs font-mono text-ink-secondary text-center">
          Semantic verification unavailable — deterministic rules only.
        </div>
      )}

      <div className="p-4 flex flex-col gap-4">
        {/* Sentence Location */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
            Sentence Location
          </span>
          <div className="mt-1 font-mono text-xs text-ink font-semibold">
            {finding.sentenceId}, chars {finding.startOffset}–{finding.endOffset}
          </div>
        </div>

        {/* Candidate or Flagged Span */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
            {isCandidate ? 'Candidate Claim Segment' : 'Draft Text Under Scrutiny'}
          </span>
          <div className="mt-1 p-2 bg-paper border border-strong-border rounded-xs font-serif text-sm italic text-ink">
            "{finding.flaggedText || finding.candidateText}"
          </div>
        </div>

        {/* Explanation / Rationale */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
            Audit Rationale
          </span>
          <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
            {isCandidate && claimVerification?.rationale
              ? claimVerification.rationale
              : finding.explanation}
          </p>
        </div>

        {/* CLAIM_CANDIDATE Verification Section */}
        {isCandidate && (
          <div className="p-3 bg-subtle border border-strong-border rounded-xs flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-ink-tertiary">
                Verifier Status
              </span>
              <StatusBadge
                status={isSupported ? 'SUPPORTED' : isConflict ? 'CONFLICT' : 'UNVERIFIED'}
                customLabel={candidateStatus}
              />
            </div>

            {claimVerification?.sourceFactId && (
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-ink-secondary">Citing Fact ID:</span>
                <span className="text-ink font-semibold">{claimVerification.sourceFactId}</span>
              </div>
            )}

            {claimVerification?.reason && (
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-ink-secondary">Downgrade Reason:</span>
                <span className="text-unverified font-semibold">{claimVerification.reason}</span>
              </div>
            )}

            {/* Verbatim Source Quote Quotation Block */}
            {claimVerification?.exactSourceQuote && (
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary block mb-1">
                  Verbatim Source Quote
                </span>
                <blockquote className="p-2 bg-paper border-l-2 border-strong-border text-xs font-serif italic text-ink">
                  "{claimVerification.exactSourceQuote}"
                </blockquote>
              </div>
            )}

            {/* CONFLICT_FOUND: Side-by-side Quote Diff */}
            {isConflict && claimVerification?.exactSourceQuote && (
              <div className="mt-1 p-2.5 bg-conflict-tint border border-conflict-border rounded-xs flex flex-col gap-2 text-xs">
                <span className="text-[10px] font-mono uppercase tracking-wider text-conflict font-semibold">
                  Evidence Contradiction
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-paper border border-conflict-border rounded-xs">
                    <span className="text-[10px] font-mono text-conflict uppercase block mb-1">Draft Claim</span>
                    <span className="font-serif italic text-ink">"{finding.flaggedText || finding.candidateText}"</span>
                  </div>
                  <div className="p-2 bg-paper border border-strong-border rounded-xs">
                    <span className="text-[10px] font-mono text-ink-secondary uppercase block mb-1">Approved Fact Quote</span>
                    <span className="font-serif italic text-ink">"{claimVerification.exactSourceQuote}"</span>
                  </div>
                </div>
              </div>
            )}

            {candidateStatus === 'UNVERIFIED' && !claimVerification?.sourceFactId && (
              <p className="mt-1 text-xs text-ink-secondary italic">
                Hint: Qualify this claim with approved trial parameters or add supporting documentation to the Fact Registry.
              </p>
            )}
          </div>
        )}

        {/* Rule citation (strictly for deterministic findings, NEVER for claim candidates) */}
        {!isCandidate && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
              Cited Rule Authority
            </span>
            <div className="mt-1 p-2.5 bg-subtle border border-strong-border rounded-xs flex flex-col gap-1">
              <span className="font-mono text-xs font-semibold text-ink">
                {finding.evidence.ruleId}
              </span>
              <p className="text-xs text-ink-secondary">
                {finding.evidence.ruleDescription}
              </p>
            </div>
          </div>
        )}

        {/* WCAG Alt-Text Distinction Note (§1.1) */}
        {finding.ruleId === 'WCAG_ALT_TEXT' && (
          <div className="p-2.5 bg-paper border border-strong-border rounded-xs text-xs">
            <span className="text-[10px] font-mono uppercase text-ink-tertiary block mb-1">
              Accessibility Scope Boundary
            </span>
            <p className="text-xs font-sans text-ink font-medium">
              Metadata check only — no image content analysis performed.
            </p>
          </div>
        )}

        {/* WCAG Contrast Numeric Ratio Display (§1.1) */}
        {finding.ruleId === 'WCAG_CONTRAST' && (
          <div className="p-2.5 bg-paper border border-conflict-border rounded-xs text-xs flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase text-conflict font-semibold">
              WCAG AA Color Contrast Analysis
            </span>
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-ink-secondary">Computed Ratio:</span>
              <span className="font-bold text-conflict">
                {(() => {
                  const r =
                    (finding.evidence as any)?.ratio ??
                    (finding as any).ratio ??
                    parseFloat(finding.explanation.match(/(\d+(?:\.\d+)?):1/)?.[1] || '');
                  return !isNaN(r) ? `${r}:1` : 'Below 4.5:1';
                })()}
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-[10px] text-ink-tertiary">
              <span>Required AA Minimum:</span>
              <span>≥ 4.5:1</span>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-3 border-t border-muted-border flex flex-col gap-2">
          {hasSuggestedCorrection && (
            <>
              <div className="p-2.5 bg-paper border border-supported-border rounded-xs">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary block mb-1">
                  Suggested Rewrite
                </span>
                <span className="text-xs font-sans text-ink">
                  {effectiveCorrection}
                </span>
              </div>

              {isEditingCorrection ? (
                <div className="flex flex-col gap-2">
                  <TextInput
                    value={editedCorrection}
                    onChange={(e) => setEditedCorrection(e.target.value)}
                    placeholder="Enter custom correction..."
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        if (onApplyRewrite && editedCorrection.trim()) {
                          onApplyRewrite(editedCorrection);
                          setIsEditingCorrection(false);
                        }
                      }}
                    >
                      Confirm Replacement
                    </Button>
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => setIsEditingCorrection(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => onApplyRewrite && effectiveCorrection && onApplyRewrite(effectiveCorrection)}
                  >
                    Apply Rewrite
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditedCorrection(effectiveCorrection || '');
                      setIsEditingCorrection(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </>
          )}

          {onDismiss && (
            <Button variant="subtle" size="sm" onClick={onDismiss}>
              Dismiss Finding
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};
