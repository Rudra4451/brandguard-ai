import React from 'react';
import { IconSquareStamp } from '../primitives/Icons';

export type ViewType = 'workspace' | 'rules' | 'facts' | 'history' | 'insights' | 'bench';

interface NavigationRailProps {
  activeView: ViewType;
  onSelectView: (view: ViewType) => void;
  rulebookHash?: string;
  className?: string;
}

const NAV_ITEMS: { id: ViewType; label: string; code: string }[] = [
  { id: 'workspace', label: 'Workspace', code: '01' },
  { id: 'rules', label: 'Brand Rules', code: '02' },
  { id: 'facts', label: 'Approved Facts', code: '03' },
  { id: 'history', label: 'Review History', code: '04' },
  { id: 'insights', label: 'Insights', code: '05' },
  { id: 'bench', label: 'Judge Bench', code: '06' },
];

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeView,
  onSelectView,
  rulebookHash,
  className = '',
}) => {
  return (
    <nav
      className={`w-60 h-full flex flex-col bg-[#09090B] border-r border-zinc-800 select-none text-zinc-200 ${className}`}
      aria-label="Navigation Rail"
    >
      {/* Brand Header */}
      <div className="h-14 px-4 border-b border-zinc-800/80 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center border border-zinc-700">
          <IconSquareStamp className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div className="flex flex-col">
          <span className="font-mono font-bold text-xs tracking-widest text-white uppercase">
            BrandGuard
          </span>
          <span className="font-mono text-[9px] text-zinc-400 uppercase tracking-wider">
            Governance Console
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 py-4 px-2.5 flex flex-col gap-1">
        <span className="px-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-zinc-400">
          Scopes
        </span>
        {NAV_ITEMS.map((navItem) => {
          const isActive = activeView === navItem.id;
          return (
            <button
              key={navItem.id}
              onClick={() => onSelectView(navItem.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-sans text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-400 ${
                isActive
                  ? 'bg-zinc-850 bg-[#18181B] text-white font-medium border-l-2 border-blue-500 shadow-sm pl-2.5'
                  : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200 border-l-2 border-transparent'
              }`}
            >
              <span>{navItem.label}</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                isActive ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-900 text-zinc-400'
              }`}>
                {navItem.code}
              </span>
            </button>
          );
        })}
      </div>

      {/* Terminal Readout Status in Rail Footer */}
      <div className="p-3 border-t border-zinc-800/80 bg-[#09090B] flex flex-col gap-1.5 font-mono text-[10px]">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="tracking-wider text-[9px] uppercase">RULEBOOK_HASH</span>
          <span className="text-zinc-200 font-semibold">
            {rulebookHash ? rulebookHash.slice(0, 8) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-zinc-400">
          <span className="tracking-wider text-[9px] uppercase">ENGINE_STATUS</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LOCAL_DETERMINISTIC
          </span>
        </div>
      </div>
    </nav>
  );
};
