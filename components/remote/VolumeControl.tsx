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
    <div className="flex items-center justify-between w-64 bg-tv-surface/60 border border-tv-border/80 rounded-3xl p-2 px-4 shadow-remoteButton">
      {/* Volume Rocker Container */}
      <div className="flex items-center gap-1">
        <RemoteActionButton
          onClick={volumeDown}
          ariaLabel="Volume Down"
          variant="secondary"
          size="sm"
          disabled={!isConnected}
          className="rounded-xl w-10 h-10"
        >
          <Minus className="w-5 h-5 text-tv-textPrimary" />
        </RemoteActionButton>

        <div className="flex flex-col items-center justify-center px-3 min-w-[50px]">
          <span className="text-[10px] uppercase tracking-wider text-tv-textMuted font-medium">Vol</span>
          <span className="text-sm font-bold text-tv-textPrimary font-mono">
            {volumeLevel !== undefined ? volumeLevel : '--'}
          </span>
        </div>

        <RemoteActionButton
          onClick={volumeUp}
          ariaLabel="Volume Up"
          variant="secondary"
          size="sm"
          disabled={!isConnected}
          className="rounded-xl w-10 h-10"
        >
          <Plus className="w-5 h-5 text-tv-textPrimary" />
        </RemoteActionButton>
      </div>

      {/* Mute Button */}
      <div className="border-l border-tv-border/80 pl-3">
        <RemoteActionButton
          onClick={toggleMute}
          ariaLabel={isMuted ? 'Unmute' : 'Mute'}
          variant={isMuted ? 'danger' : 'secondary'}
          size="sm"
          disabled={!isConnected}
          className="rounded-xl w-10 h-10"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-rose-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-tv-textSecondary" />
          )}
        </RemoteActionButton>
      </div>
    </div>
  );
};

