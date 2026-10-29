import React from 'react';
import type { AuditEvent } from '../engine/audit-chain';
import type { Finding } from '../engine/types';
import type { ClaimResult } from '../../api/schemas';

interface AuditReportProps {
  brandId: string;
  draftId: string;
  draftText: string;
  schemaVersion: number;
  rulebookVersion: string;
  ruleCount: number;
  factStoreVersion: string;
  factCount: number;
  findings: Finding[];
  claims: ClaimResult[];
  approvalFingerprint: string | null;
  approvedAt: string | null;
  actorRole: string;
  isApprovalValid: boolean;
  events: readonly AuditEvent[];
  isChainValid: boolean;
  chainBreakAt: number | null;
  generationTimestamp: string;
}

export const AuditReport: React.FC<AuditReportProps> = ({
  brandId,
  draftId,
  draftText,
  schemaVersion,
  rulebookVersion,
  ruleCount,
  factStoreVersion,
  factCount,
  findings,
  approvalFingerprint,
  approvedAt,
  actorRole,
  isApprovalValid,
  events,
  isChainValid,
  chainBreakAt,
  generationTimestamp,
}) => {
  return (
    <div className="print-report-container p-8 font-sans text-ink bg-surface text-xs leading-relaxed max-w-4xl mx-auto">
      <style>{`
        @page {
          size: A4;
          margin: 18mm;
        }
        @media print {
          body {
            counter-reset: page;
          }
          .print-page-number::after {
            content: counter(page);
          }
        }
      `}</style>
      {/* Header */}
      <header className="border-b-2 border-ink pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="font-serif font-bold text-lg text-ink uppercase tracking-wide">
              BrandGuard AI — Audit Certificate
            </h1>
            <span className="font-mono text-[10px] text-ink-secondary">
              SCHEMA_VERSION: {schemaVersion} • BRAND: {brandId} • DRAFT: {draftId}
            </span>
          </div>
          <div className="text-right font-mono text-[10px]">
            <div>GENERATED: {generationTimestamp}</div>
            <div className={isChainValid ? 'text-supported font-bold' : 'text-conflict font-bold'}>
              CHAIN INTEGRITY: {isChainValid ? 'VALID' : `FAILED at EVT-${String(chainBreakAt).padStart(4, '0')}`}
            </div>
          </div>
        </div>
      </header>

      {/* Explicit Disclosure Paragraph Required by Section 8 */}
      <div className="mb-6 p-3 bg-paper border border-muted-border rounded-xs text-[11px] font-sans text-ink-secondary leading-normal">
        <strong>Attestation Notice:</strong> This audit was produced by a client-side hash chain.
        It detects modifications relative to the recorded event history, but is not by itself proof
        of an independent trusted timestamp or tamper-proof server storage.
      </div>

      {/* Draft Snapshot Section */}
      <section className="mb-6">
        <h2 className="font-serif font-bold text-sm uppercase text-ink border-b border-muted-border pb-1 mb-2">
          1. Attested Draft Snapshot
        </h2>
        <pre className="p-3 bg-paper border border-strong-border rounded-xs font-mono text-xs whitespace-pre-wrap break-words leading-relaxed text-ink">
          {draftText}
        </pre>
      </section>

      {/* Governance Authorities */}
      <section className="mb-6 grid grid-cols-2 gap-4">
        <div className="p-3 bg-paper border border-muted-border rounded-xs">
          <span className="font-mono text-[10px] uppercase text-ink-tertiary block mb-1">
            Brand Rulebook Authority
          </span>
          <div className="font-mono text-[11px] font-semibold text-ink">
            {ruleCount} Active Rules Enforced
          </div>
          <div className="font-mono text-[9px] text-ink-secondary truncate mt-1">
            HASH: {rulebookVersion}
          </div>
        </div>

        <div className="p-3 bg-paper border border-muted-border rounded-xs">
          <span className="font-mono text-[10px] uppercase text-ink-tertiary block mb-1">
            Approved Fact Registry
          </span>
          <div className="font-mono text-[11px] font-semibold text-ink">
            {factCount} Verified Fact Assertions
          </div>
          <div className="font-mono text-[9px] text-ink-secondary truncate mt-1">
            HASH: {factStoreVersion}
          </div>
        </div>
      </section>

      {/* Attestation & Approval Seal Block */}
      <section className="mb-6 p-4 bg-paper border border-strong-border rounded-xs">
        <h2 className="font-serif font-bold text-sm uppercase text-ink border-b border-muted-border pb-1 mb-3">
          2. Content Attestation & Seal
        </h2>
        <div className="grid grid-cols-2 gap-4 font-mono text-xs">
          <div>
            <span className="text-[10px] text-ink-tertiary block">Attested Fingerprint (SHA-256):</span>
            <span className="font-bold text-ink text-[11px] break-all">
              {approvalFingerprint || 'NOT_ATTESTED'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-ink-tertiary block">Seal Verification Status:</span>
            <span
              className={`font-bold ${
                isApprovalValid && approvalFingerprint
                  ? 'text-supported'
                  : 'text-conflict'
              }`}
            >
              {isApprovalValid && approvalFingerprint ? 'VALID (SEAL INTACT)' : 'INVALIDATED / PENDING'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-ink-tertiary block">Attesting Actor Role:</span>
            <span className="font-bold text-ink">{actorRole}</span>
          </div>
          <div>
            <span className="text-[10px] text-ink-tertiary block">Attestation Timestamp:</span>
            <span className="text-ink">{approvedAt || 'N/A'}</span>
          </div>
        </div>
      </section>

      {/* Findings Registry */}
      <section className="mb-6">
        <h2 className="font-serif font-bold text-sm uppercase text-ink border-b border-muted-border pb-1 mb-2">
          3. Governance Findings & Claim Scrutiny ({findings.length})
        </h2>
        {findings.length === 0 ? (
          <div className="p-3 bg-paper border border-muted-border text-center text-ink-secondary italic text-xs">
            Zero findings recorded. All active constraints satisfied.
          </div>
        ) : (
          <table className="w-full text-left border-collapse border border-muted-border text-[11px]">
            <thead>
              <tr className="bg-paper border-b border-muted-border font-mono text-[10px] text-ink-tertiary uppercase">
                <th className="p-2">Target ID</th>
                <th className="p-2">Severity</th>
                <th className="p-2">Flagged Copy</th>
                <th className="p-2">Authority / Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-border font-sans">
              {findings.map((f) => (
                <tr key={f.id} className="align-top">
                  <td className="p-2 font-mono text-[10px] font-semibold">{f.ruleId}</td>
                  <td className="p-2 font-mono text-[10px]">{f.severity}</td>
                  <td className="p-2 font-serif italic text-ink">"{f.flaggedText || f.candidateText || '—'}"</td>
                  <td className="p-2 text-ink-secondary">{f.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Cryptographic Event Chain Ledger */}
      <section className="mb-6">
        <h2 className="font-serif font-bold text-sm uppercase text-ink border-b border-muted-border pb-1 mb-2">
          4. Cryptographic Audit Event Chain ({events.length} Events)
        </h2>
        <table className="w-full text-left border-collapse border border-muted-border text-[10px] font-mono">
          <thead>
            <tr className="bg-paper border-b border-muted-border text-ink-tertiary uppercase">
              <th className="p-2">Event ID</th>
              <th className="p-2">Action</th>
              <th className="p-2">Role</th>
              <th className="p-2">Timestamp</th>
              <th className="p-2">Chained Hash H[i]</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted-border">
            {events.map((evt) => (
              <tr key={evt.eventId}>
                <td className="p-2 font-semibold text-ink">{evt.eventId}</td>
                <td className="p-2">{evt.action}</td>
                <td className="p-2">{evt.actorRole}</td>
                <td className="p-2">{evt.timestamp}</td>
                <td className="p-2 text-ink-secondary font-mono">{evt.hash.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Footer */}
      <footer className="border-t border-muted-border pt-4 mt-8 flex justify-between font-mono text-[9px] text-ink-tertiary">
        <span>BrandGuard AI Governance Console • Certified Production Snapshot</span>
        <span className="print-page-number">Page 1 of 1</span>
      </footer>
    </div>
  );
};
