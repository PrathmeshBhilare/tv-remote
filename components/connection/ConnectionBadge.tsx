'use client';

import React from 'react';
import { ConnectionState } from '../../src/integrations/tv/types';

interface ConnectionBadgeProps {
  state: ConnectionState;
  tvName?: string;
  onClick?: () => void;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({ state, tvName, onClick }) => {
  const getBadgeConfig = () => {
    switch (state) {
      case 'connected':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-500 animate-pulse',
          label: tvName || 'Connected',
        };
      case 'connecting':
      case 'reconnecting':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-500 animate-ping',
          label: 'Connecting...',
        };
      case 'pairing_prompt':
        return {
          bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
          dot: 'bg-indigo-500 animate-bounce',
          label: 'Accept on TV',
        };
      case 'error':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-500',
          label: 'Connection Error',
        };
      case 'disconnected':
      default:
        return {
          bg: 'bg-slate-800/60 border-slate-700 text-slate-400',
          dot: 'bg-slate-500',
          label: 'Not Connected',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium tracking-wide transition-colors ${config.bg} ${
        onClick ? 'hover:brightness-125 cursor-pointer active:scale-95' : 'cursor-default'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </button>
  );
};

