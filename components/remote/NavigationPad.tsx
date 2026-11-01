'use client';

import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { RemoteActionButton } from './RemoteActionButton';
import { useTV } from '../../src/hooks/use-tv';

export const NavigationPad: React.FC = () => {
  const { pressKey, connectionState } = useTV();
  const isConnected = connectionState === 'connected';

  return (
    <div className="flex flex-col items-center justify-center gap-6 my-2">
      {/* Top Action Keys: Back and Home */}
      <div className="flex items-center justify-between w-64 px-2">
        <RemoteActionButton
          onClick={() => pressKey('BACK')}
          ariaLabel="Back"
          variant="secondary"
          size="md"
          disabled={!isConnected}
          className="rounded-full"
        >
          <ArrowLeft className="w-5 h-5 text-tv-textSecondary" />
        </RemoteActionButton>

        <span className="text-xs uppercase tracking-widest text-tv-textMuted font-semibold select-none">
          Navigation
        </span>

        <RemoteActionButton
          onClick={() => pressKey('HOME')}
          ariaLabel="Home"
          variant="secondary"
          size="md"
          disabled={!isConnected}
          className="rounded-full"
        >
          <Home className="w-5 h-5 text-tv-textSecondary" />
        </RemoteActionButton>
      </div>

      {/* Main Circular D-Pad */}
      <div className="relative w-64 h-64 rounded-full bg-tv-surface/90 border border-tv-border shadow-remotePad flex items-center justify-center p-3 select-none">
        {/* UP Button */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2">
          <RemoteActionButton
            onClick={() => pressKey('UP')}
            ariaLabel="Up"
            variant="ghost"
            size="pad"
            disabled={!isConnected}
            className="w-16 h-14 rounded-t-3xl"
          >
            <ChevronUp className="w-7 h-7 text-tv-textPrimary" />
          </RemoteActionButton>
        </div>

        {/* DOWN Button */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <RemoteActionButton
            onClick={() => pressKey('DOWN')}
            ariaLabel="Down"
            variant="ghost"
            size="pad"
            disabled={!isConnected}
            className="w-16 h-14 rounded-b-3xl"
          >
            <ChevronDown className="w-7 h-7 text-tv-textPrimary" />
          </RemoteActionButton>
        </div>

        {/* LEFT Button */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <RemoteActionButton
            onClick={() => pressKey('LEFT')}
            ariaLabel="Left"
            variant="ghost"
            size="pad"
            disabled={!isConnected}
            className="w-14 h-16 rounded-l-3xl"
          >
            <ChevronLeft className="w-7 h-7 text-tv-textPrimary" />
          </RemoteActionButton>
        </div>

        {/* RIGHT Button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <RemoteActionButton
            onClick={() => pressKey('RIGHT')}
            ariaLabel="Right"
            variant="ghost"
            size="pad"
            disabled={!isConnected}
            className="w-14 h-16 rounded-r-3xl"
          >
            <ChevronRight className="w-7 h-7 text-tv-textPrimary" />
          </RemoteActionButton>
        </div>

        {/* Center OK Button */}
        <RemoteActionButton
          onClick={() => pressKey('ENTER')}
          ariaLabel="OK"
          variant="primary"
          size="lg"
          disabled={!isConnected}
          className="w-20 h-20 rounded-full border border-tv-borderActive/40 bg-tv-surfaceActive/80 shadow-activeGlow"
        >
          <span className="font-bold text-sm tracking-widest text-tv-textPrimary">OK</span>
        </RemoteActionButton>
      </div>
    </div>
  );
};
