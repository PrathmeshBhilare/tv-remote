'use client';

import React, { useState } from 'react';
import { Tv, Power, WifiOff, Link, Sparkles } from 'lucide-react';
import { useTV } from '../src/hooks/use-tv';
import { ConnectionBadge } from '../components/connection/ConnectionBadge';
import { NavigationPad } from '../components/remote/NavigationPad';
import { VolumeControl } from '../components/remote/VolumeControl';
import { AppShortcuts } from '../components/remote/AppShortcuts';
import { MediaControls } from '../components/remote/MediaControls';
import { YouTubeSearchInput } from '../components/search/YouTubeSearchInput';
import { DevicesSettings } from '../components/connection/DevicesSettings';
import { ManualIpEntry } from '../components/connection/ManualIpEntry';
import { PairingScreen } from '../components/connection/PairingScreen';
import { BottomNav, TabType } from '../components/layout/BottomNav';
import { SplashScreen } from '../components/layout/SplashScreen';
import { PWAInstallPrompt } from '../components/pwa/PWAInstallPrompt';

export default function HomePage() {
  const {
    currentProfile,
    connectionState,
    lastFeedback,
    postPairingTest,
    powerOff,
    isConnectModalOpen,
    openConnectModal,
    closeConnectModal,
  } = useTV();

  const [currentTab, setCurrentTab] = useState<TabType>('remote');
  const [showPairingScreen, setShowPairingScreen] = useState(false);

  const isConnected = connectionState === 'connected';
  const isPairingActive =
    showPairingScreen ||
    connectionState === 'pairing_prompt' ||
    connectionState === 'pairing_pin';

  return (
    <div className="w-full max-w-md min-h-screen flex flex-col justify-between bg-tv-bg text-tv-textPrimary safe-area-pt safe-area-pb relative pb-20">
      {/* Starting Splash Page & Animation on Launch */}
      <SplashScreen />

      {/* Floating PWA Download / Install App Prompt */}
      <PWAInstallPrompt />

      {/* Toast Notification Banner */}
      {lastFeedback && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl text-xs font-medium shadow-2xl transition-all duration-200 flex items-center gap-2 max-w-[90%] ${
            lastFeedback.isError
              ? 'bg-rose-950/95 text-rose-300 border border-rose-800'
              : 'bg-slate-900/95 text-cyan-300 border border-cyan-800/60'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          <span>{lastFeedback.text}</span>
        </div>
      )}

      {/* Header */}
      <header className="w-full px-5 py-4 flex items-center justify-between border-b border-tv-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center shadow-sm shadow-cyan-500/10">
            <Tv className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-extrabold tracking-tight text-white leading-none">
                Lumina
              </h1>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                REMOTE
              </span>
            </div>
            <span className="text-[10px] text-tv-textMuted tracking-wide">webOS Smart TV</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ConnectionBadge
            state={connectionState}
            tvName={currentProfile?.name}
            onClick={openConnectModal}
          />

          <button
            type="button"
            disabled={!isConnected}
            onClick={powerOff}
            aria-label="Power Off TV"
            className="w-8 h-8 rounded-full bg-tv-surface hover:bg-rose-500/20 active:bg-rose-500/30 border border-tv-border flex items-center justify-center text-tv-textMuted hover:text-rose-400 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-3 w-full">
        {/* VIEW 1: ACTIVE PAIRING SCREEN */}
        {isPairingActive ? (
          <PairingScreen
            onBack={() => {
              setShowPairingScreen(false);
              closeConnectModal();
            }}
            onSuccess={() => {
              setShowPairingScreen(false);
              closeConnectModal();
              setCurrentTab('remote');
            }}
          />
        ) : isConnectModalOpen ? (
          /* VIEW 2: MANUAL IP & DISCOVERY CONNECT SCREEN */
          <div className="w-full flex flex-col items-center py-2 animate-fadeIn">
            {currentProfile && (
              <div className="w-full flex justify-end px-4 mb-2">
                <button
                  type="button"
                  onClick={closeConnectModal}
                  className="text-xs text-tv-textMuted hover:text-tv-textSecondary p-1 cursor-pointer"
                >
                  Back to Remote
                </button>
              </div>
            )}
            <ManualIpEntry
              onSuccess={() => closeConnectModal()}
              onPairingNeeded={() => setShowPairingScreen(true)}
            />
          </div>
        ) : (
          /* VIEW 3: MAIN APPLICATION TABS */
          <>
            {/* Disconnected Notice Banner if not connected */}
            {!isConnected && (
              <div className="w-full max-w-sm mb-3">
                <button
                  type="button"
                  onClick={openConnectModal}
                  className="w-full p-2.5 px-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300 hover:bg-amber-500/15 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>TV not connected — tap to pair</span>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <Link className="w-3.5 h-3.5" />
                    Connect
                  </span>
                </button>
              </div>
            )}

            {/* Post-pairing Physical TV Verification Pill (if completed) */}
            {postPairingTest && isConnected && (
              <div className="w-full max-w-sm mb-2 px-1">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-300">
                  <span className="font-medium truncate">{postPairingTest.message}</span>
                  <span className="text-[10px] text-emerald-400 font-mono ml-2 shrink-0">
                    {postPairingTest.timestamp}
                  </span>
                </div>
              </div>
            )}

            {/* TAB: REMOTE */}
            {currentTab === 'remote' && (
              <div className="flex flex-col items-center gap-4 w-full">
                {/* Volume Rocker */}
                <VolumeControl />

                {/* Circular Navigation Pad with OK, Home, Back */}
                <NavigationPad />

                {/* YouTube & Netflix Quick Launch */}
                <AppShortcuts />
              </div>
            )}

            {/* TAB: SEARCH */}
            {currentTab === 'search' && (
              <div className="w-full flex justify-center">
                <YouTubeSearchInput />
              </div>
            )}

            {/* TAB: MEDIA */}
            {currentTab === 'media' && (
              <div className="w-full flex flex-col items-center justify-center gap-4">
                <div className="text-center mb-1">
                  <h3 className="text-sm font-semibold text-tv-textPrimary">Media Playback</h3>
                  <p className="text-xs text-tv-textSecondary">Playback keys for supported webOS apps</p>
                </div>
                <MediaControls />
              </div>
            )}

            {/* TAB: SETTINGS */}
            {currentTab === 'settings' && (
              <div className="w-full flex justify-center">
                <DevicesSettings onAddDevice={openConnectModal} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Tab Bar */}
      {!isConnectModalOpen && !isPairingActive && (
        <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
      )}
    </div>
  );
}
