import React from 'react';

export type Channel = 'LinkedIn' | 'Meta Ad' | 'Email' | 'Product Description';

interface EditorToolbarProps {
  channel: Channel;
  onChannelChange: (channel: Channel) => void;
  charCount: number;
  channelLimit?: number;
  wordCount: number;
  onRunAudit: () => void;
  isAuditDisabled: boolean;
  isStale: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const CHANNELS: Channel[] = ['LinkedIn', 'Meta Ad', 'Email', 'Product Description'];

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  channel,
  onChannelChange,
  charCount,
  channelLimit,
  wordCount,
  onRunAudit,
  isAuditDisabled,
  isStale,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const isOverLimit = channelLimit !== undefined && charCount > channelLimit;

  return (
    <div className="px-4 py-2 bg-white border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Channel selector and Undo/Redo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label htmlFor="channel-select" className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Channel:
          </label>
          <select
            id="channel-select"
            value={channel}
            onChange={(e) => onChannelChange(e.target.value as Channel)}
            className="px-2 py-1 text-xs font-mono bg-zinc-50 hover:bg-zinc-100 text-zinc-900 border border-zinc-200 rounded focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer transition-colors"
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-px bg-zinc-200" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo edit"
            title="Undo (Ctrl+Z)"
            className="px-2 py-1 text-xs font-mono font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo edit"
            title="Redo (Ctrl+Y)"
            className="px-2 py-1 text-xs font-mono font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            Redo
          </button>
        </div>
      </div>

      {/* Metrics & Audit Trigger */}
      <div className="flex items-center gap-4">
        {/* Character / word metrics */}
        <div className="flex items-center gap-2.5 font-mono text-xs">
          <span className="text-zinc-500">{wordCount} words</span>
          <span className="text-zinc-300">•</span>
          <span className={isOverLimit ? 'text-red-600 font-semibold' : 'text-zinc-600'}>
            {channelLimit !== undefined ? `${charCount} / ${channelLimit} chars` : `${charCount} chars`}
          </span>
        </div>

        <div className="h-4 w-px bg-zinc-200" />

        {/* Governance Audit Button (Electric Blue) */}
        <button
          type="button"
          onClick={onRunAudit}
          disabled={isAuditDisabled}
          title={isAuditDisabled ? 'Nothing to inspect.' : isStale ? 'Findings stale — re-run audit' : 'Run inspection'}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-sans font-semibold rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200 disabled:cursor-not-allowed text-white shadow-xs border border-blue-700 cursor-pointer transition-colors"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <span>{isStale ? 'Re-run Governance Audit' : 'Run Governance Audit'}</span>
        </button>
      </div>
    </div>
  );
};
