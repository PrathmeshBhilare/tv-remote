'use client';

import React, { useState } from 'react';
import { PlaySquare, Film, Tv, Sparkles, X } from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';

interface AppShortcutsProps {
  onOpenAllApps?: () => void;
}

export const AppShortcuts: React.FC<AppShortcutsProps> = ({ onOpenAllApps }) => {
  const { launchApp, installedApps, connectionState } = useTV();
  const isConnected = connectionState === 'connected';
  const [showAllModal, setShowAllModal] = useState(false);

  // App ID resolution with installed fallbacks
  const findAppId = (keywords: string[], fallback: string) => {
    const match = installedApps.find((app) =>
      keywords.some(
        (kw) =>
          app.id.toLowerCase().includes(kw) ||
          app.title.toLowerCase().includes(kw)
      )
    );
    return match ? match.id : fallback;
  };

  const youtubeId = findAppId(['youtube'], 'youtube.leanback.v4');
  const netflixId = findAppId(['netflix'], 'netflix');
  const primeId = findAppId(['amazon', 'prime'], 'amazon');
  const disneyId = findAppId(['disney'], 'com.disney.disneyplus-prod');

  const apps = [
    {
      id: youtubeId,
      name: 'YouTube',
      badge: 'App',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#F1EEE3] text-[#F1EEE3]" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
    },
    {
      id: netflixId,
      name: 'Netflix',
      badge: 'App',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#F1EEE3]" fill="currentColor">
          <path d="M5.398 0v24h3.693V12.984l5.962 11.016h3.549V0h-3.693v11.016L8.947 0H5.398z"/>
        </svg>
      ),
    },
    {
      id: primeId,
      name: 'Prime Video',
      badge: 'App',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#F1EEE3]" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
        </svg>
      ),
    },
    {
      id: disneyId,
      name: 'Disney+',
      badge: 'App',
      icon: (
        <Sparkles className="w-4 h-4 text-[#B6AD83]" />
      ),
    },
  ];

  return (
    <div className="w-full max-w-[320px] flex flex-col gap-2 my-1">
      {/* Quick Apps Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-wider text-[#737267] font-semibold">
          Quick Apps
        </span>
        <button
          type="button"
          onClick={() => {
            if (onOpenAllApps) onOpenAllApps();
            else setShowAllModal(true);
          }}
          className="text-[11px] text-[#B6AD83] hover:text-[#D5CBA8] transition-colors cursor-pointer"
        >
          All Apps &rarr;
        </button>
      </div>

      {/* Grid of 4 Quick Apps */}
      <div className="grid grid-cols-4 gap-2 w-full">
        {apps.map((app) => (
          <button
            key={app.name}
            type="button"
            onClick={() => launchApp(app.id)}
            disabled={!isConnected}
            className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-[#191A15] hover:bg-[#20221B] active:bg-[#25261F] border border-[#2A2C23] shadow-remoteButton transition-all group disabled:opacity-40 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-[#25261F] border border-[#36382E] flex items-center justify-center mb-1.5 group-hover:border-[#B6AD83]/40 transition-colors">
              {app.icon}
            </div>
            <span className="text-[10px] font-medium text-[#F1EEE3] truncate max-w-full">
              {app.name}
            </span>
          </button>
        ))}
      </div>

      {/* Modal / Drawer for All Apps if opened */}
      {showAllModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="w-full max-w-md bg-[#191A15] border border-[#2A2C23] rounded-3xl p-5 flex flex-col gap-4 max-h-[75vh] shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#2A2C23] pb-3">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-[#B6AD83]" />
                <h3 className="text-sm font-bold text-[#F1EEE3]">Installed TV Apps</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAllModal(false)}
                className="p-1.5 rounded-full hover:bg-[#25261F] text-[#737267] hover:text-[#F1EEE3] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[50vh] grid grid-cols-3 gap-2.5 py-1">
              {installedApps.length > 0 ? (
                installedApps.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      launchApp(item.id);
                      setShowAllModal(false);
                    }}
                    className="flex flex-col items-center p-3 rounded-2xl bg-[#25261F] hover:bg-[#2F3127] border border-[#36382E] text-center transition-colors cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#191A15] border border-[#2A2C23] flex items-center justify-center mb-1.5 group-hover:border-[#B6AD83]/40">
                      <Tv className="w-4 h-4 text-[#B6AD83]" />
                    </div>
                    <span className="text-xs font-medium text-[#F1EEE3] truncate w-full">
                      {item.title}
                    </span>
                  </button>
                ))
              ) : (
                <div className="col-span-3 text-center py-8 text-xs text-[#737267]">
                  No apps detected yet. Connect to your TV to sync installed apps.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
