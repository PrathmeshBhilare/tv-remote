'use client';

import React from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  ArrowLeft,
  Keyboard,
  MousePointer,
} from 'lucide-react';
import { RemoteActionButton } from './RemoteActionButton';
import { useTV } from '../../src/hooks/use-tv';

interface NavigationPadProps {
  onOpenKeyboard?: () => void;
}

export const NavigationPad: React.FC<NavigationPadProps> = ({ onOpenKeyboard }) => {
  const { pressKey, connectionState } = useTV();
  const isConnected = connectionState === 'connected';

  return (
    <div className="flex flex-col items-center justify-center gap-5 my-1 w-full max-w-[320px]">
      {/* Secondary Controls - Top Row (Back, Home, Keyboard) */}
      <div className="flex items-center justify-between w-full px-4">
        {/* Back Button */}
        <RemoteActionButton
          onClick={() => pressKey('BACK')}
          ariaLabel="Back"
          variant="primary"
          size="sm"
          disabled={!isConnected}
          className="rounded-2xl w-11 h-11 border border-[#2A2C23]"
        >
          <ArrowLeft className="w-4 h-4 text-[#A8A69A]" />
        </RemoteActionButton>

        {/* Central Subtle Label */}
        <span className="text-[10px] uppercase tracking-[0.25em] text-[#737267] font-semibold select-none">
          Navigation
        </span>

        {/* Home Button */}
        <RemoteActionButton
          onClick={() => pressKey('HOME')}
          ariaLabel="Home"
          variant="primary"
          size="sm"
          disabled={!isConnected}
          className="rounded-2xl w-11 h-11 border border-[#2A2C23]"
        >
          <Home className="w-4 h-4 text-[#A8A69A]" />
        </RemoteActionButton>
      </div>

      {/* Main Circular D-Pad Controller */}
      <div className="relative w-64 h-64 rounded-full bg-gradient-to-b from-[#1C1D17] to-[#141511] border border-[#2D2F25] shadow-remotePad flex items-center justify-center p-3 select-none">
        {/* Subtle Outer Concentric Bevel */}
        <div className="absolute inset-1 rounded-full border border-white/[0.03] pointer-events-none" />

        {/* UP Button */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2">
          <RemoteActionButton
            onClick={() => pressKey('UP')}
            ariaLabel="Up"
            variant="dpad"
            size="pad"
            disabled={!isConnected}
            className="w-20 h-16 rounded-t-full flex items-start justify-center pt-2"
          >
            <ChevronUp className="w-6 h-6 text-[#B6AD83] hover:text-[#D5CBA8] transition-colors" />
          </RemoteActionButton>
        </div>

        {/* DOWN Button */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <RemoteActionButton
            onClick={() => pressKey('DOWN')}
            ariaLabel="Down"
            variant="dpad"
            size="pad"
            disabled={!isConnected}
            className="w-20 h-16 rounded-b-full flex items-end justify-center pb-2"
          >
            <ChevronDown className="w-6 h-6 text-[#B6AD83] hover:text-[#D5CBA8] transition-colors" />
          </RemoteActionButton>
        </div>

        {/* LEFT Button */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          <RemoteActionButton
            onClick={() => pressKey('LEFT')}
            ariaLabel="Left"
            variant="dpad"
            size="pad"
            disabled={!isConnected}
            className="w-16 h-20 rounded-l-full flex items-center justify-start pl-2"
          >
            <ChevronLeft className="w-6 h-6 text-[#B6AD83] hover:text-[#D5CBA8] transition-colors" />
          </RemoteActionButton>
        </div>

        {/* RIGHT Button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <RemoteActionButton
            onClick={() => pressKey('RIGHT')}
            ariaLabel="Right"
            variant="dpad"
            size="pad"
            disabled={!isConnected}
            className="w-16 h-20 rounded-r-full flex items-center justify-end pr-2"
          >
            <ChevronRight className="w-6 h-6 text-[#B6AD83] hover:text-[#D5CBA8] transition-colors" />
          </RemoteActionButton>
        </div>

        {/* Central OK Button */}
        <RemoteActionButton
          onClick={() => pressKey('ENTER')}
          ariaLabel="OK"
          variant="primary"
          size="lg"
          disabled={!isConnected}
          className="w-20 h-20 rounded-full border border-[#B6AD83]/35 bg-[#141511] shadow-dpadCenter hover:border-[#D5CBA8]/60 transition-all flex items-center justify-center z-10"
        >
          <span className="font-bold text-sm tracking-widest text-[#F1EEE3]">
            OK
          </span>
        </RemoteActionButton>
      </div>

      {/* Secondary Controls - Bottom Row (Keyboard shortcut, Pointer click) */}
      <div className="flex items-center justify-center gap-4 w-full px-6">
        {onOpenKeyboard && (
          <button
            type="button"
            onClick={onOpenKeyboard}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#191A15] hover:bg-[#20221B] border border-[#2A2C23] text-[#A8A69A] hover:text-[#F1EEE3] text-xs font-medium transition-colors cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5 text-[#B6AD83]" />
            <span>Keyboard</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => pressKey('ENTER')}
          disabled={!isConnected}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#191A15] hover:bg-[#20221B] border border-[#2A2C23] text-[#A8A69A] hover:text-[#F1EEE3] text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
        >
          <MousePointer className="w-3.5 h-3.5 text-[#B6AD83]" />
          <span>Click</span>
        </button>
      </div>
    </div>
  );
};
