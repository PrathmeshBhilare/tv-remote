'use client';

import React from 'react';
import { PlaySquare, Film } from 'lucide-react';
import { useTV } from '../../src/hooks/use-tv';

export const AppShortcuts: React.FC = () => {
  const { launchApp, installedApps, connectionState } = useTV();
  const isConnected = connectionState === 'connected';

  // Find dynamic app IDs from TV installed apps
  const youtubeApp = installedApps.find((a) =>
    a.id.toLowerCase().includes('youtube') || a.title.toLowerCase().includes('youtube')
  );
  const netflixApp = installedApps.find((a) =>
    a.id.toLowerCase().includes('netflix') || a.title.toLowerCase().includes('netflix')
  );

  const youtubeId = youtubeApp?.id || 'youtube.leanback.v4';
  const netflixId = netflixApp?.id || 'netflix';

  return (
    <div className="flex items-center justify-center gap-3 w-64 my-1">
      {/* YouTube Button */}
      <button
        type="button"
        onClick={() => launchApp(youtubeId)}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border shadow-remoteButton transition-all select-none group cursor-pointer ${
          !isConnected ? 'opacity-70' : ''
        }`}
      >
        <div className="w-6 h-6 rounded-lg bg-red-600/20 flex items-center justify-center border border-red-500/30 group-hover:scale-105 transition-transform">
          <PlaySquare className="w-3.5 h-3.5 text-red-500 fill-red-500" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-semibold text-tv-textPrimary">YouTube</span>
          <span className="text-[9px] text-tv-textMuted uppercase">
            {youtubeApp ? 'Installed' : 'Launch'}
          </span>
        </div>
      </button>

      {/* Netflix Button */}
      <button
        type="button"
        onClick={() => launchApp(netflixId)}
        className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive border border-tv-border shadow-remoteButton transition-all select-none group cursor-pointer ${
          !isConnected ? 'opacity-70' : ''
        }`}
      >
        <div className="w-6 h-6 rounded-lg bg-red-600/20 flex items-center justify-center border border-red-500/30 group-hover:scale-105 transition-transform">
          <Film className="w-3.5 h-3.5 text-red-500" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-semibold text-tv-textPrimary">Netflix</span>
          <span className="text-[9px] text-tv-textMuted uppercase">
            {netflixApp ? 'Installed' : 'Launch'}
          </span>
        </div>
      </button>
    </div>
  );
};
