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
          bg: 'bg-[#8F9E6D]/15 border-[#8F9E6D]/35 text-[#D5CBA8]',
          dot: 'bg-[#8F9E6D]',
          label: tvName || 'Connected',
        };
      case 'connecting':
      case 'reconnecting':
        return {
          bg: 'bg-[#B6AD83]/15 border-[#B6AD83]/30 text-[#D5CBA8]',
          dot: 'bg-[#B6AD83] animate-pulse',
          label: 'Connecting...',
        };
      case 'pairing_prompt':
      case 'pairing_pin':
        return {
          bg: 'bg-[#D5CBA8]/15 border-[#D5CBA8]/35 text-[#F1EEE3]',
          dot: 'bg-[#D5CBA8] animate-ping',
          label: 'Pairing...',
        };
      case 'error':
        return {
          bg: 'bg-[#C95D53]/15 border-[#C95D53]/35 text-[#C95D53]',
          dot: 'bg-[#C95D53]',
          label: 'Connection Error',
        };
      case 'disconnected':
      default:
        return {
          bg: 'bg-[#191A15] border-[#2A2C23] text-[#737267]',
          dot: 'bg-[#4A4B42]',
          label: 'Not Connected',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <button
      onClick={onClick}
      type="button"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium tracking-wide transition-all ${config.bg} ${
        onClick ? 'hover:border-[#B6AD83]/50 cursor-pointer active:scale-95' : 'cursor-default'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className="truncate max-w-[120px]">{config.label}</span>
    </button>
  );
};
