'use client';

import React, { useState, useEffect } from 'react';
import { Tv, Sparkles, Wifi } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Initializing Lumina...');

  useEffect(() => {
    // Stage 1: Initializing
    const timer1 = setTimeout(() => {
      setLoadingStep('Connecting to webOS...');
    }, 600);

    // Stage 2: Ready
    const timer2 = setTimeout(() => {
      setLoadingStep('Ready!');
      setIsFadingOut(true);
    }, 1300);

    // Stage 3: Complete & Unmount
    const timer3 = setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onFinish]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between py-12 px-6 bg-[#0B0E17] select-none transition-all duration-500 ease-out ${
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-cyan-500/10 blur-[90px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-indigo-500/10 blur-[80px] pointer-events-none" />

      {/* Top spacer */}
      <div className="w-full flex justify-end">
        <button
          type="button"
          onClick={() => {
            setIsFadingOut(true);
            setTimeout(() => {
              setIsVisible(false);
              onFinish?.();
            }, 300);
          }}
          className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors p-2 cursor-pointer"
        >
          Skip &rarr;
        </button>
      </div>

      {/* Center Branding & Animated Icon */}
      <div className="flex flex-col items-center gap-6 relative">
        {/* Pulsing Concentric Wave Rings */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-36 h-36 rounded-full border border-cyan-500/20 animate-ping opacity-30" />
          <div className="absolute w-28 h-28 rounded-full border border-indigo-500/30 animate-pulse" />

          {/* Main Glowing Badge */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-2xl shadow-cyan-500/30 flex items-center justify-center relative z-10">
            <div className="w-full h-full rounded-[22px] bg-[#070A12] flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-indigo-500/10" />
              <Tv className="w-9 h-9 text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
            </div>
          </div>
        </div>

        {/* Brand Text */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-2xl font-black tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 uppercase drop-shadow-sm">
            LUMINA
          </h1>
          <span className="text-xs text-slate-400 tracking-wider font-medium flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Smart webOS Remote
          </span>
        </div>
      </div>

      {/* Bottom Loading Spinner & Status */}
      <div className="flex flex-col items-center gap-4 w-full max-w-xs">
        {/* Modern Neon Arc Spinner */}
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-slate-800" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-400 animate-spin" />
          <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] animate-pulse" />
        </div>

        {/* Status Text with WiFi Icon */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <Wifi className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span className="animate-fadeIn">{loadingStep}</span>
        </div>

        <span className="text-[10px] text-slate-600 font-mono tracking-widest mt-2">
          v1.0 • PWA Ready
        </span>
      </div>
    </div>
  );
};

