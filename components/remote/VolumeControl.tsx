'use client';

import React from 'react';
import { Volume2, VolumeX, Plus, Minus } from 'lucide-react';
import { RemoteActionButton } from './RemoteActionButton';
import { useTV } from '../../src/hooks/use-tv';

export const VolumeControl: React.FC = () => {
  const { volumeUp, volumeDown, toggleMute, tvStatus, connectionState } = useTV();
  const isConnected = connectionState === 'connected';
  const isMuted = tvStatus?.isMuted ?? false;
  const volumeLevel = tvStatus?.volumeLevel;

  return (
    <div className="flex items-center justify-between w-full max-w-[290px] bg-[#191A15] border border-[#2A2C23] rounded-3xl p-1.5 px-3 shadow-remoteButton">
      {/* Volume Decrement / Increment Container */}
      <div className="flex items-center gap-1.5 flex-1 justify-between pr-2">
        <RemoteActionButton
          onClick={volumeDown}
          ariaLabel="Volume Down"
          variant="primary"
          size="sm"
          disabled={!isConnected}
          className="rounded-2xl w-10 h-10 border border-[#36382E]"
        >
          <Minus className="w-4 h-4 text-[#F1EEE3]" />
        </RemoteActionButton>

        <div className="flex flex-col items-center justify-center px-2 min-w-[56px] select-none">
          <span className="text-[9px] uppercase tracking-wider text-[#737267] font-semibold">
            VOL
          </span>
          <span className="text-sm font-bold text-[#F1EEE3] font-mono tracking-tight">
            {volumeLevel !== undefined ? volumeLevel : '--'}
          </span>
        </div>

        <RemoteActionButton
          onClick={volumeUp}
          ariaLabel="Volume Up"
          variant="primary"
          size="sm"
          disabled={!isConnected}
          className="rounded-2xl w-10 h-10 border border-[#36382E]"
        >
          <Plus className="w-4 h-4 text-[#F1EEE3]" />
        </RemoteActionButton>
      </div>

      {/* Subtle Divider */}
      <div className="w-[1px] h-7 bg-[#2A2C23]" />

      {/* Mute Button */}
      <div className="pl-2">
        <RemoteActionButton
          onClick={toggleMute}
          ariaLabel={isMuted ? 'Unmute' : 'Mute'}
          variant={isMuted ? 'danger' : 'primary'}
          size="sm"
          disabled={!isConnected}
          className="rounded-2xl w-10 h-10 border border-[#36382E]"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-[#C95D53]" />
          ) : (
            <Volume2 className="w-4 h-4 text-[#A8A69A]" />
          )}
        </RemoteActionButton>
      </div>
    </div>
  );
};
