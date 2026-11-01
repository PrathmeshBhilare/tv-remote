'use client';

import React from 'react';
import { Play, Pause, Square, RotateCcw, RotateCw } from 'lucide-react';
import { RemoteActionButton } from './RemoteActionButton';
import { useTV } from '../../src/hooks/use-tv';

export const MediaControls: React.FC = () => {
  const { mediaPlay, mediaPause, mediaStop, mediaRewind, mediaFastForward, connectionState } = useTV();
  const isConnected = connectionState === 'connected';

  return (
    <div className="flex flex-col items-center gap-3 w-64 bg-tv-surface/60 border border-tv-border/80 rounded-3xl p-3 px-4 shadow-remoteButton">
      <div className="flex items-center justify-between w-full">
        {/* Rewind */}
        <RemoteActionButton
          onClick={mediaRewind}
          ariaLabel="Rewind"
          variant="secondary"
          size="sm"
          disabled={!isConnected}
          className="rounded-xl w-10 h-10"
        >
          <RotateCcw className="w-4 h-4 text-tv-textSecondary" />
        </RemoteActionButton>

        {/* Play */}
        <RemoteActionButton
          onClick={mediaPlay}
          ariaLabel="Play"
          variant="primary"
          size="md"
          disabled={!isConnected}
          className="rounded-2xl w-12 h-12"
        >
          <Play className="w-5 h-5 text-tv-textPrimary fill-tv-textPrimary" />
        </RemoteActionButton>

        {/* Pause */}
        <RemoteActionButton
          onClick={mediaPause}
          ariaLabel="Pause"
          variant="primary"
          size="md"
          disabled={!isConnected}
          className="rounded-2xl w-12 h-12"
        >
          <Pause className="w-5 h-5 text-tv-textPrimary fill-tv-textPrimary" />
        </RemoteActionButton>

        {/* Fast Forward */}
        <RemoteActionButton
          onClick={mediaFastForward}
          ariaLabel="Fast Forward"
          variant="secondary"
          size="sm"
          disabled={!isConnected}
          className="rounded-xl w-10 h-10"
        >
          <RotateCw className="w-4 h-4 text-tv-textSecondary" />
        </RemoteActionButton>

        {/* Stop */}
        <RemoteActionButton
          onClick={mediaStop}
          ariaLabel="Stop"
          variant="secondary"
          size="sm"
          disabled={!isConnected}
          className="rounded-xl w-10 h-10"
        >
          <Square className="w-4 h-4 text-tv-textSecondary fill-tv-textSecondary" />
        </RemoteActionButton>
      </div>

      <p className="text-[10px] text-center text-tv-textMuted px-2">
        Note: Media command compatibility depends on the active TV app. DRM-protected apps (like Netflix) may ignore or restrict remote media keys.
      </p>
    </div>
  );
};
