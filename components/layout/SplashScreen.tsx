'use client';

import React, { useState, useEffect } from 'react';
import { Tv } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Initializing LG Control...');

  useEffect(() => {
    // Stage 1
    const timer1 = setTimeout(() => {
      setLoadingStep('Connecting to webOS...');
    }, 600);

    // Stage 2
    const timer2 = setTimeout(() => {
      setLoadingStep('Ready');
      setIsFadingOut(true);
    }, 1200);

    // Stage 3
    const timer3 = setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, 1600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onFinish]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between py-14 px-6 bg-[#10110E] select-none transition-all duration-500 ease-out ${
        isFadingOut ? 'opacity-0 scale-102 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle Warm Amber / Olive Ambient Backlight */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-[#B6AD83]/5 blur-[100px] pointer-events-none" />

      {/* Top Skip Button */}
      <div className="w-full flex justify-end">
        <button
          type="button"
          onClick={() => {
            setIsFadingOut(true);
            setTimeout(() => {
              setIsVisible(false);
              onFinish?.();
            }, 200);
          }}
          className="text-xs text-[#737267] hover:text-[#A8A69A] transition-colors p-2 cursor-pointer"
        >
          Skip &rarr;
        </button>
      </div>

      {/* Center Branding & Icon */}
      <div className="flex flex-col items-center gap-6 relative">
        {/* Refined Concentric Waves */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-32 h-32 rounded-full border border-[#B6AD83]/10 animate-ping opacity-30" />
          <div className="absolute w-24 h-24 rounded-full border border-[#D5CBA8]/15" />

          {/* Luxury Rounded Square Icon */}
          <div className="w-20 h-20 rounded-3xl bg-[#191A15] border border-[#2A2C23] shadow-card flex items-center justify-center relative z-10 p-4">
            <div className="relative flex items-center justify-center">
              {/* Television Outline */}
              <Tv className="w-10 h-10 text-[#F1EEE3] stroke-[1.75]" />
              {/* Inner D-Pad Dot */}
              <span className="absolute w-2.5 h-2.5 rounded-full bg-[#B6AD83]" />
            </div>
          </div>
        </div>

        {/* Brand Title */}
        <div className="flex flex-col items-center text-center gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#F1EEE3]">
            LG Control
          </h1>
          <p className="text-xs text-[#A8A69A] tracking-wider uppercase font-medium">
            Smart TV Remote
          </p>
        </div>
      </div>

      {/* Bottom Loading Status & Fine Spinner */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-[#2A2C23] border-t-[#B6AD83] animate-spin" />
        <span className="text-[11px] font-mono text-[#737267]">
          {loadingStep}
        </span>
      </div>
    </div>
  );
};
