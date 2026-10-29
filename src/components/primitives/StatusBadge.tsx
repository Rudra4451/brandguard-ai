import React from 'react';
import {
  IconCheckCircle,
  IconAlertTriangle,
  IconHexagonCross,
  IconShieldCheck,
  IconBrokenLink
} from './Icons';

export type StatusType = 'SUPPORTED' | 'UNVERIFIED' | 'CONFLICT' | 'DETERMINISTIC' | 'INVALIDATED';

interface StatusBadgeProps {
  status: StatusType;
  customLabel?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  customLabel,
  className = '',
}) => {
  switch (status) {
    case 'SUPPORTED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium rounded-xs bg-supported-tint text-supported border border-supported-border ${className}`}
        >
          <IconCheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{customLabel || 'SUPPORTED'}</span>
        </span>
      );
    case 'UNVERIFIED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium rounded-xs bg-unverified-tint text-unverified border border-unverified-border ${className}`}
        >
          <IconAlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{customLabel || 'UNVERIFIED'}</span>
        </span>
      );
    case 'CONFLICT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium rounded-xs bg-conflict-tint text-conflict border border-conflict-border ${className}`}
        >
          <IconHexagonCross className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{customLabel || 'VIOLATION'}</span>
        </span>
      );
    case 'DETERMINISTIC':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium rounded-xs bg-deterministic-tint text-deterministic border border-deterministic-border ${className}`}
        >
          <IconShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{customLabel || 'RULE (DET)'}</span>
        </span>
      );
    case 'INVALIDATED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium rounded-xs bg-invalidated-tint text-invalidated border border-invalidated-border ${className}`}
        >
          <IconBrokenLink className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{customLabel || 'INVALIDATED'}</span>
        </span>
      );
  }
};
