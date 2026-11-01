'use client';

import React, { useState } from 'react';
import {
  Tv,
  Power,
  WifiOff,
  Link,
  Settings2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useTV } from '../src/hooks/use-tv';
import { ConnectionBadge } from '../components/connection/ConnectionBadge';
import { NavigationPad } from '../components/remote/NavigationPad';
import { VolumeControl } from '../components/remote/VolumeControl';
import { AppShortcuts } from '../components/remote/AppShortcuts';
import { MediaControls } from '../components/remote/MediaControls';
import { AppsScreen } from '../components/apps/AppsScreen';
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
    tvStatus,
    lastFeedback,
    postPairingTest,
    powerOff,
    isConnectModalOpen,
    openConnectModal,
    closeConnectModal,
  } = useTV();

  const [currentTab, setCurrentTab] = useState<TabType>('remote');
  const [showPairingScreen, setShowPairingScreen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const isConnected = connectionState === 'connected';
  const isPairingActive =
    showPairingScreen ||
    connectionState === 'pairing_prompt' ||
    connectionState === 'pairing_pin';

  return (
    <div className="w-full max-w-md min-h-screen flex flex-col justify-between bg-[#10110E] text-[#F1EEE3] safe-area-pt safe-area-pb relative pb-20 mx-auto select-none">
      {/* Starting Splash Page & Animation on Launch */}
      <SplashScreen />

      {/* Floating PWA Download / Install App Prompt */}
      <PWAInstallPrompt />

      {/* Toast Notification Banner in Luxury Palette */}
      {lastFeedback && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl text-xs font-medium shadow-2xl transition-all duration-200 flex items-center gap-2 max-w-[90%] border ${
            lastFeedback.isError
              ? 'bg-[#191A15]/95 text-[#C95D53] border-[#C95D53]/40'
              : 'bg-[#191A15]/95 text-[#D5CBA8] border-[#B6AD83]/40'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              lastFeedback.isError ? 'bg-[#C95D53]' : 'bg-[#B6AD83]'
            }`}
          />
          <span className="truncate">{lastFeedback.text}</span>
        </div>
      )}

      {/* Header */}
      <header className="w-full px-5 py-3.5 flex items-center justify-between border-b border-[#2A2C23]">
        {/* App Icon & Branding */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#191A15] border border-[#2A2C23] shadow-sm flex items-center justify-center p-1.5 relative">
            <Tv className="w-5 h-5 text-[#F1EEE3]" />
            <span className="absolute w-1.5 h-1.5 rounded-full bg-[#B6AD83] top-1 right-1" />
          </div>
          <div className="flex flex-col text-left">
            <h1 className="text-sm font-bold tracking-tight text-[#F1EEE3] leading-none">
              LG Control
            </h1>
            <span className="text-[10px] text-[#737267] tracking-wider uppercase font-medium mt-0.5">
              Smart TV Remote
            </span>
          </div>
        </div>

        {/* Right Header Controls (Badge, Settings, Power) */}
        <div className="flex items-center gap-2">
          <ConnectionBadge
            state={connectionState}
            tvName={currentProfile?.name}
            onClick={openConnectModal}
          />

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            aria-label="Device Settings"
            className="w-8 h-8 rounded-full bg-[#191A15] hover:bg-[#20221B] border border-[#2A2C23] flex items-center justify-center text-[#737267] hover:text-[#F1EEE3] transition-colors cursor-pointer"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            disabled={!isConnected}
            onClick={powerOff}
            aria-label="Power Off TV"
            className="w-8 h-8 rounded-full bg-[#191A15] hover:bg-[#C95D53]/20 active:bg-[#C95D53]/30 border border-[#2A2C23] flex items-center justify-center text-[#737267] hover:text-[#C95D53] transition-colors disabled:opacity-30 cursor-pointer"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-3 w-full">
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
                  className="text-xs text-[#737267] hover:text-[#F1EEE3] p-1 cursor-pointer transition-colors"
                >
                  Back to Remote &rarr;
                </button>
              </div>
            )}
            <ManualIpEntry
              onSuccess={() => closeConnectModal()}
              onPairingNeeded={() => setShowPairingScreen(true)}
            />
          </div>
        ) : showSettingsModal ? (
          /* VIEW 3: SETTINGS MODAL / DRAWER */
          <div className="w-full flex flex-col items-center py-2 animate-fadeIn">
            <div className="w-full flex justify-between items-center px-4 mb-3 border-b border-[#2A2C23] pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#F1EEE3]">
                Device Settings
              </span>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-xs text-[#737267] hover:text-[#F1EEE3] cursor-pointer"
              >
                Close &times;
              </button>
            </div>
            <DevicesSettings
              onAddDevice={() => {
                setShowSettingsModal(false);
                openConnectModal();
              }}
            />
          </div>
        ) : (
          /* VIEW 4: MAIN APPLICATION TABS */
          <>
            {/* TAB: REMOTE */}
            {currentTab === 'remote' && (
              <div className="flex flex-col items-center gap-3.5 w-full">
                {/* Connected TV Card */}
                <div
                  onClick={openConnectModal}
                  className="w-full max-w-[320px] bg-[#191A15] border border-[#2A2C23] hover:border-[#B6AD83]/40 rounded-3xl p-3 px-3.5 flex items-center justify-between shadow-card transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#25261F] border border-[#36382E] flex items-center justify-center shrink-0 group-hover:border-[#B6AD83]/40 transition-colors">
                      <Tv className="w-5 h-5 text-[#B6AD83]" />
                    </div>
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#F1EEE3] truncate max-w-[140px]">
                          {currentProfile?.name || 'LG Smart TV'}
                        </span>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isConnected ? 'bg-[#8F9E6D]' : 'bg-[#737267]'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-[#737267] font-mono">
                        {currentProfile?.ip || '192.168.1.10'} • webOS
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-[#737267] group-hover:text-[#D5CBA8] transition-colors">
                    <span>{isConnected ? 'Switch' : 'Connect'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Disconnected Notice Banner if not connected */}
                {!isConnected && (
                  <div className="w-full max-w-[320px]">
                    <button
                      type="button"
                      onClick={openConnectModal}
                      className="w-full p-2.5 px-3 rounded-2xl bg-[#25261F]/60 border border-[#36382E] flex items-center justify-between text-xs text-[#A8A69A] hover:text-[#F1EEE3] hover:bg-[#25261F] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <WifiOff className="w-4 h-4 text-[#B6AD83] shrink-0" />
                        <span>TV not connected — tap to pair</span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#B6AD83] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <Link className="w-3 h-3" />
                        Connect
                      </span>
                    </button>
                  </div>
                )}

                {/* Post-pairing Physical TV Verification Pill (if completed) */}
                {postPairingTest && isConnected && (
                  <div className="w-full max-w-[320px] px-1">
                    <div className="bg-[#8F9E6D]/10 border border-[#8F9E6D]/30 rounded-2xl p-2.5 flex items-center justify-between text-xs text-[#D5CBA8]">
                      <span className="font-medium truncate">{postPairingTest.message}</span>
                      <span className="text-[10px] text-[#8F9E6D] font-mono ml-2 shrink-0">
                        {postPairingTest.timestamp}
                      </span>
                    </div>
                  </div>
                )}

                {/* Volume Rocker Controller */}
                <VolumeControl />

                {/* Circular Navigation Pad with OK, Home, Back */}
                <NavigationPad onOpenKeyboard={() => setCurrentTab('search')} />

                {/* Quick App Launchers */}
                <AppShortcuts onOpenAllApps={() => setCurrentTab('apps')} />
              </div>
            )}

            {/* TAB: APPS */}
            {currentTab === 'apps' && <AppsScreen />}

            {/* TAB: SEARCH */}
            {currentTab === 'search' && <YouTubeSearchInput />}

            {/* TAB: MEDIA */}
            {currentTab === 'media' && (
              <div className="w-full flex flex-col items-center justify-center gap-4 py-3">
                <div className="text-center mb-1">
                  <h3 className="text-sm font-bold text-[#F1EEE3]">Media Playback</h3>
                  <p className="text-xs text-[#A8A69A]">Playback controls for active TV player apps</p>
                </div>
                <MediaControls />
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      {!isConnectModalOpen && !isPairingActive && !showSettingsModal && (
        <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
      )}
    </div>
  );
}
