'use client';

import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Square } from 'lucide-react';
import { RemoteActionButton } from './RemoteActionButton';
import { useTV } from '../../src/hooks/use-tv';

export const MediaControls: React.FC = () => {
  const { mediaPlay, mediaPause, mediaStop, mediaRewind, mediaFastForward, connectionState } = useTV();
  const isConnected = connectionState === 'connected';

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[290px] bg-[#191A15] border border-[#2A2C23] rounded-3xl p-3 px-4 shadow-remoteButton">
      <div className="flex items-center justify-between w-full">
        {/* Previous / Rewind */}
        <RemoteActionButton
          onClick={mediaRewind}
          ariaLabel="Previous / Rewind"
          variant="primary"
          size="sm"
          disabled={!isConnected}
          className="rounded-2xl w-10 h-10 border border-[#36382E]"
        >
          <SkipBack className="w-4 h-4 text-[#A8A69A]" />
        </RemoteActionButton>

        {/* Play */}
        <RemoteActionButton
          onClick={mediaPlay}
          ariaLabel="Play"
          variant="accent"
          size="md"
          disabled={!isConnected}
          className="rounded-2xl w-12 h-12"
        >
          <Play className="w-5 h-5 text-[#10110E] fill-[#10110E] ml-0.5" />
        </RemoteActionButton>

        {/* Pause */}
        <RemoteActionButton
          onClick={mediaPause}
          ariaLabel="Pause"
          variant="primary"
          size="md"
          disabled={!isConnected}
          className="rounded-2xl w-12 h-12 border border-[#36382E]"
        >
          <Pause className="w-5 h-5 text-[#F1EEE3] fill-[#F1EEE3]" />
        </RemoteActionButton>

        {/* Next / Fast Forward */}
        <RemoteActionButton
          onClick={mediaFastForward}
          ariaLabel="Next / Fast Forward"
          variant="primary"
          size="sm"
          disabled={!isConnected}
          className="rounded-2xl w-10 h-10 border border-[#36382E]"
        >
          <SkipForward className="w-4 h-4 text-[#A8A69A]" />
        </RemoteActionButton>

        {/* Stop */}
        <RemoteActionButton
          onClick={mediaStop}
          ariaLabel="Stop"
          variant="primary"
          size="sm"
          disabled={!isConnected}
          className="rounded-2xl w-10 h-10 border border-[#36382E]"
        >
          <Square className="w-3.5 h-3.5 text-[#A8A69A] fill-[#A8A69A]" />
        </RemoteActionButton>
      </div>

      <span className="text-[10px] text-center text-[#737267] font-medium leading-tight">
        Playback keys for webOS media &amp; player apps
      </span>
    </div>
  );
};
