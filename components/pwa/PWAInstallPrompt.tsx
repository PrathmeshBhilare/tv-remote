'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  Share,
  PlusSquare,
  X,
  ChevronUp,
  Sparkles,
  Smartphone,
  Tv,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(true); // default true to avoid flash on mount
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if app is running as installed PWA (standalone)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');

      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isAppleDevice);

    // Listen for beforeinstallprompt event (Android / Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setInstalledSuccessfully(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log('[Lumina PWA] App successfully installed!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // If already running in standalone mode or installed, don't show the prompt
  if (isStandalone || installedSuccessfully) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalledSuccessfully(true);
        setDeferredPrompt(null);
      }
    } else {
      // If browser doesn't support deferred prompt (e.g. desktop safari/firefox)
      setShowIOSInstructions(true);
    }
  };

  // Minimized state: sleek floating pill button
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-40 animate-fadeIn">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-cyan-500/90 to-blue-600/90 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all border border-cyan-400/40 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>Install App</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Floating PWA Install Banner */}
      <aside aria-label="Install Lumina Remote Web App" className="fixed bottom-20 left-4 right-4 max-w-sm mx-auto z-40 animate-slideUp">
        <div className="relative p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 flex flex-col gap-3">
          {/* Top row: Icon, text, minimize */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* App Icon */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 shadow-md shadow-cyan-500/30 flex items-center justify-center shrink-0">
                <div className="w-full h-full rounded-[10px] bg-slate-950 flex items-center justify-center">
                  <Tv className="w-5 h-5 text-cyan-400" />
                </div>
              </div>

              {/* Title & Desc */}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white tracking-wide">
                    Install Lumina Remote
                  </span>
                  <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-semibold border border-cyan-500/30">
                    <Sparkles className="w-2.5 h-2.5" /> PWA
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Install for 1-tap instant launch &amp; full screen remote.
                </span>
              </div>
            </div>

            {/* Minimize button */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Minimize"
              aria-label="Minimize install banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex-1 h-9 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isIOS ? 'Install on iPhone / iPad' : 'Download Web App'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="px-3 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>
      </aside>

      {/* iOS / Safari Step-by-Step Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700/80 p-5 shadow-2xl flex flex-col gap-4 animate-slideUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">How to Install on iPhone</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSInstructions(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-800/80 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Steps list */}
            <div className="flex flex-col gap-3 py-1 text-xs text-slate-300">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    Tap the Share Button
                    <Share className="w-3.5 h-3.5 text-blue-400 inline" />
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Located in Safari&apos;s bottom navigation bar (the square with an arrow pointing up).
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    Tap &quot;Add to Home Screen&quot;
                    <PlusSquare className="w-3.5 h-3.5 text-cyan-400 inline" />
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Scroll down the share options list and choose &quot;Add to Home Screen&quot;.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50">
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-white">Tap &quot;Add&quot;</span>
                  <span className="text-[11px] text-slate-400">
                    Confirm in the top right corner. Lumina Remote will appear on your Home Screen!
                  </span>
                </div>
              </div>
            </div>

            {/* Close CTA */}
            <button
              type="button"
              onClick={() => setShowIOSInstructions(false)}
              className="w-full h-11 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-white font-semibold text-xs transition-all cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

