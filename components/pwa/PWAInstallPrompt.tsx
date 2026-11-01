'use client';

import React, { useState, useEffect } from 'react';
import {
  Download,
  Share,
  PlusSquare,
  X,
  Tv,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [installedSuccessfully, setInstalledSuccessfully] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');

      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(isAppleDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalledSuccessfully(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isStandalone || installedSuccessfully || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstalledSuccessfully(true);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      {/* Floating Bottom Install Banner */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 max-w-md mx-auto pointer-events-none animate-fadeIn">
        <div className="bg-[#191A15]/95 backdrop-blur-md border border-[#2A2C23] shadow-card rounded-2xl p-3 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#25261F] border border-[#36382E] flex items-center justify-center shrink-0">
              <Tv className="w-5 h-5 text-[#B6AD83]" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#F1EEE3]">LG Control</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#B6AD83]/15 text-[#D5CBA8] font-semibold">
                  App
                </span>
              </div>
              <span className="text-[10px] text-[#A8A69A]">Install for fullscreen remote</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="h-8 px-3 rounded-xl bg-[#B6AD83] hover:bg-[#C4BB91] text-[#10110E] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="p-1.5 rounded-lg text-[#737267] hover:text-[#F1EEE3] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Add to Home Screen Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="w-full max-w-md bg-[#191A15] border border-[#2A2C23] rounded-3xl p-5 flex flex-col gap-4 text-left shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#2A2C23] pb-3">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-[#B6AD83]" />
                <h3 className="text-sm font-bold text-[#F1EEE3]">Install LG Control on iPhone</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSInstructions(false)}
                className="p-1 rounded-full text-[#737267] hover:text-[#F1EEE3] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs text-[#A8A69A]">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#25261F] flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4 text-[#B6AD83]" />
                </div>
                <span>1. Tap the <strong>Share</strong> button at the bottom of Safari.</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#25261F] flex items-center justify-center shrink-0">
                  <PlusSquare className="w-4 h-4 text-[#B6AD83]" />
                </div>
                <span>2. Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSInstructions(false)}
              className="w-full h-10 rounded-xl bg-[#25261F] border border-[#36382E] text-[#F1EEE3] font-medium text-xs transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
