import { StatusBadge, type StatusType } from './StatusBadge';
import { Button } from './Button';


export interface FindingEvidence {
  id: string;
  sourceType: 'RULE' | 'FACT';
  sourceId: string;
  status: StatusType;
  title: string;
  flaggedText: string;
  evidenceQuote: string;
  explanation: string;
  suggestedRewrite?: string;
}

interface EvidenceInspectorProps {
  finding: FindingEvidence | null;
  onApplyRewrite?: (rewrite: string) => void;
  onClose?: () => void;
  className?: string;
}

export const EvidenceInspector: React.FC<EvidenceInspectorProps> = ({
  finding,
  onApplyRewrite,
  onClose,
  className = '',
}) => {
  if (!finding) {
    return (
      <aside
        className={`w-full h-full p-4 flex flex-col items-center justify-center text-center bg-surface border-l border-muted-border ${className}`}
      >
        <span className="text-xs font-mono text-ink-tertiary">
          [NO_SELECTION]
        </span>
        <p className="mt-2 text-xs text-ink-secondary max-w-[200px]">
          Select an annotated sentence in the draft or a diagnostic finding to inspect citations.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={`w-full h-full flex flex-col bg-surface border-l border-muted-border overflow-y-auto ${className}`}
      aria-label="Evidence Inspector"
    >
      {/* Header bar */}
      <div className="p-3 border-b border-muted-border bg-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-ink">
            {finding.id}
          </span>
          <StatusBadge status={finding.status} />
        </div>
        {onClose && (
          <Button variant="subtle" size="sm" onClick={onClose} aria-label="Close inspector">
            ✕
          </Button>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Cited Rule / Fact Anchor */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
            Cited Authority
          </span>
          <div className="mt-1 flex items-center gap-2 font-mono text-xs font-semibold text-ink">
            <span className="px-1.5 py-0.5 bg-subtle border border-strong-border rounded-xs">
              {finding.sourceId}
            </span>
            <span className="text-xs font-sans text-ink-secondary">
              ({finding.sourceType === 'RULE' ? 'Deterministic Rule' : 'Approved Fact Source'})
            </span>
          </div>
        </div>

        {/* Flagged Span */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
            Draft Text Under Scrutiny
          </span>
          <div className="mt-1 p-2 bg-paper border border-strong-border rounded-xs font-serif text-sm italic text-ink">
            "{finding.flaggedText}"
          </div>
        </div>

        {/* Rationale & Evidence */}
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
            Audit Rationale
          </span>
          <p className="mt-1 text-xs text-ink-secondary leading-relaxed">
            {finding.explanation}
          </p>
        </div>

        {/* Supporting or Conflicting Document Quote */}
        {finding.evidenceQuote && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
              Ground Truth Reference
            </span>
            <blockquote className="mt-1 p-2 bg-subtle border-l-2 border-strong-border text-xs font-sans text-ink">
              {finding.evidenceQuote}
            </blockquote>
          </div>
        )}

        {/* Suggested Rewrite Section */}
        {finding.suggestedRewrite && (
          <div className="mt-2 pt-3 border-t border-muted-border flex flex-col gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
              Compliance-Compliant Rewrite
            </span>
            <div className="p-2.5 bg-paper border border-supported-border rounded-xs text-xs font-sans text-ink">
              {finding.suggestedRewrite}
            </div>
            {onApplyRewrite && (
              <Button
                variant="primary"
                size="sm"
                className="w-full mt-1"
                onClick={() => onApplyRewrite(finding.suggestedRewrite!)}
              >
                Apply Suggested Rewrite
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
