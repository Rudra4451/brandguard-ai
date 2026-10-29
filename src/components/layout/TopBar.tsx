import React from 'react';
import { IconFileText } from '../primitives/Icons';

export type ReviewState = 'DRAFT' | 'APPROVED' | 'RE_REVIEW_REQUESTED' | 'REJECTED';
export type InspectionState = 'UNAUDITED' | 'INSPECTED' | 'STALE';
export type SaveState = 'UNSAVED' | 'SAVED';
export type ActorRole = 'AUTHOR' | 'REVIEWER' | 'COMPLIANCE';

interface TopBarProps {
  activeBrand: string;
  draftTitle: string;
  reviewState: ReviewState;
  inspectionState: InspectionState;
  saveState: SaveState;
  actorRole: ActorRole;
  onRoleChange: (role: ActorRole) => void;
  isChainValid: boolean;
  onExportReport: () => void;
  onExportWorkspace?: () => void;
  onImportWorkspace?: (file: File) => void;
  onLoadPresets?: () => void;
  onBackToHome?: () => void;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeBrand,
  draftTitle,
  reviewState,
  inspectionState,
  saveState,
  actorRole,
  onRoleChange,
  isChainValid,
  onExportReport,
  onExportWorkspace,
  onImportWorkspace,
  onLoadPresets,
  onBackToHome,
  className = '',
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <header
      className={`h-12 px-4 border-b border-zinc-800 bg-[#09090B] flex items-center justify-between select-none text-zinc-100 ${className}`}
    >
      {/* Brand & Draft Identity */}
      <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
        {onBackToHome && (
          <button
            type="button"
            onClick={onBackToHome}
            title="Return to Landing Page"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded transition-colors cursor-pointer"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Home</span>
          </button>
        )}
        <span className="font-mono text-xs font-bold tracking-widest text-white uppercase flex items-center gap-1.5 whitespace-nowrap">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          BRANDGUARD
        </span>
        <div className="h-4 w-px bg-zinc-800 flex-shrink-0" />
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-[11px] text-zinc-200 whitespace-nowrap flex-shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-zinc-400">BRAND:</span>
          <span className="font-medium text-white">{activeBrand}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-zinc-300 min-w-0 whitespace-nowrap">
          <IconFileText className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          <span className="text-[10px] uppercase tracking-wider text-zinc-400">DRAFT:</span>
          <span className="font-medium text-white max-w-[160px] truncate">{draftTitle}</span>
        </div>
      </div>

      {/* State Badges & Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Orthogonal States: Inspection & Save */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Inspection
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-mono font-medium rounded border ${
              inspectionState === 'INSPECTED'
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                : inspectionState === 'STALE'
                ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
            }`}
          >
            {inspectionState}
          </span>

          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 ml-1">
            Persistence
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-mono font-medium rounded border ${
              saveState === 'SAVED'
                ? 'bg-zinc-900 text-zinc-200 font-semibold border-zinc-800'
                : 'bg-zinc-950 text-zinc-500 border-zinc-900 italic'
            }`}
          >
            {saveState}
          </span>

          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 ml-1">
            Review
          </span>
          {reviewState === 'APPROVED' && (
            <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
              APPROVED
            </span>
          )}
          {reviewState === 'DRAFT' && (
            <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              UNAUDITED_DRAFT
            </span>
          )}
          {reviewState === 'RE_REVIEW_REQUESTED' && (
            <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-amber-950/80 text-amber-300 border border-amber-800/80">
              RE_REVIEW_REQUESTED
            </span>
          )}
          {reviewState === 'REJECTED' && (
            <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-red-950/80 text-red-400 border border-red-800/80">
              REJECTED
            </span>
          )}
        </div>

        {/* Actor Role Switcher */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="actor-role-select" className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Role:
          </label>
          <select
            id="actor-role-select"
            value={actorRole}
            onChange={(e) => onRoleChange(e.target.value as ActorRole)}
            className="px-2 py-0.5 text-xs font-mono bg-zinc-900 text-white border border-zinc-800 rounded focus-visible:outline-2 focus-visible:outline-blue-500 cursor-pointer"
          >
            <option value="AUTHOR">AUTHOR</option>
            <option value="REVIEWER">REVIEWER</option>
            <option value="COMPLIANCE">COMPLIANCE</option>
          </select>
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        {/* Chain Integrity Badge */}
        <span
          className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded border flex items-center gap-1.5 ${
            isChainValid
              ? 'bg-emerald-950/90 text-emerald-400 border-emerald-800'
              : 'bg-red-950/90 text-red-400 border-red-800'
          }`}
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${isChainValid ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {isChainValid ? 'CHAIN_VALID' : 'INTEGRITY_FAILED'}
        </span>

        {/* Load Presets Button */}
        {onLoadPresets && (
          <button
            type="button"
            onClick={onLoadPresets}
            title="Load judge test bench presets"
            className="px-2.5 py-1 text-xs font-mono font-medium rounded bg-blue-950/60 hover:bg-blue-900 text-blue-300 border border-blue-800/80 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Load Presets
          </button>
        )}

        <input
          type="file"
          ref={fileInputRef}
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onImportWorkspace) {
              onImportWorkspace(file);
              e.target.value = '';
            }
          }}
        />

        {onExportWorkspace && (
          <button
            type="button"
            onClick={onExportWorkspace}
            title="Download workspace JSON backup with schemaVersion: 1"
            className="px-2.5 py-1 text-xs font-mono font-medium rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
          >
            Export JSON
          </button>
        )}

        {onImportWorkspace && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import workspace backup (JSON)"
            className="px-2.5 py-1 text-xs font-mono font-medium rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
          >
            Import JSON
          </button>
        )}

        <button
          type="button"
          onClick={onExportReport}
          disabled={!isChainValid}
          title={isChainValid ? 'Export audit certificate (print)' : 'Export disabled: chain integrity check failed'}
          className="px-2.5 py-1 text-xs font-mono font-medium rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
        >
          Print Report
        </button>
      </div>
    </header>
  );
};
