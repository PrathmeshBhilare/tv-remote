'use client';

import React from 'react';
import { Tv, Sparkles, RefreshCw } from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';

export const AppsScreen: React.FC = () => {
  const { launchApp, installedApps, connectionState, openConnectModal } = useTV();
  const isConnected = connectionState === 'connected';

  // Major streaming apps
  const streamingApps = [
    {
      id: 'youtube.leanback.v4',
      name: 'YouTube',
      category: 'Video',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#F1EEE3]" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
    },
    {
      id: 'netflix',
      name: 'Netflix',
      category: 'Movies',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#F1EEE3]" fill="currentColor">
          <path d="M5.398 0v24h3.693V12.984l5.962 11.016h3.549V0h-3.693v11.016L8.947 0H5.398z"/>
        </svg>
      ),
    },
    {
      id: 'amazon',
      name: 'Prime Video',
      category: 'Streaming',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#F1EEE3]" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
        </svg>
      ),
    },
    {
      id: 'com.disney.disneyplus-prod',
      name: 'Disney+',
      category: 'Entertainment',
      icon: (
        <Sparkles className="w-5 h-5 text-[#B6AD83]" />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5 w-full max-w-sm px-4 select-none pb-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-bold text-[#F1EEE3] flex items-center gap-2">
          <Tv className="w-5 h-5 text-[#B6AD83]" />
          <span>Smart TV Applications</span>
        </h2>
        <p className="text-xs text-[#A8A69A]">
          Launch and switch applications directly on your LG TV.
        </p>
      </div>

      {/* Featured Streaming Apps */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[10px] uppercase tracking-wider text-[#737267] font-semibold">
          Featured
        </span>

        <div className="grid grid-cols-2 gap-2.5">
          {streamingApps.map((app) => (
            <button
              key={app.name}
              type="button"
              onClick={() => {
                if (!isConnected) {
                  openConnectModal();
                  return;
                }
                launchApp(app.id);
              }}
              className="flex items-center gap-3 p-3.5 rounded-3xl bg-[#191A15] hover:bg-[#20221B] active:bg-[#25261F] border border-[#2A2C23] shadow-card transition-all text-left cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#25261F] border border-[#36382E] flex items-center justify-center shrink-0 group-hover:border-[#B6AD83]/40 transition-colors">
                {app.icon}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#F1EEE3] truncate">
                  {app.name}
                </span>
                <span className="text-[10px] text-[#737267]">
                  {app.category}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Installed TV Apps Section */}
      <div className="flex flex-col gap-2.5 mt-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-[#737267] font-semibold">
            All Installed on TV ({installedApps.length})
          </span>
          {!isConnected && (
            <span className="text-[10px] text-[#737267]">Connect TV to view all</span>
          )}
        </div>

        {installedApps.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {installedApps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => launchApp(app.id)}
                className="flex flex-col items-center p-3 rounded-2xl bg-[#191A15] hover:bg-[#20221B] active:bg-[#25261F] border border-[#2A2C23] text-center transition-colors cursor-pointer group shadow-card"
              >
                <div className="w-9 h-9 rounded-2xl bg-[#25261F] border border-[#36382E] flex items-center justify-center mb-1.5 group-hover:border-[#B6AD83]/40 transition-colors">
                  <Tv className="w-4 h-4 text-[#B6AD83]" />
                </div>
                <span className="text-xs font-medium text-[#F1EEE3] truncate w-full">
                  {app.title}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-3xl bg-[#191A15] border border-dashed border-[#2A2C23] text-center flex flex-col items-center gap-2 text-xs text-[#737267]">
            <Tv className="w-7 h-7 text-[#737267]/50" />
            <p>
              {isConnected
                ? 'Fetching installed apps list from webOS...'
                : 'Connect to your LG TV to sync all installed applications.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

