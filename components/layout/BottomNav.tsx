'use client';

import React from 'react';
import { Gamepad2, Search, Clapperboard, Settings2 } from 'lucide-react';

export type TabType = 'remote' | 'search' | 'media' | 'settings';

interface BottomNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'remote' as TabType, label: 'Remote', icon: Gamepad2 },
    { id: 'search' as TabType, label: 'Search', icon: Search },
    { id: 'media' as TabType, label: 'Media', icon: Clapperboard },
    { id: 'settings' as TabType, label: 'Devices', icon: Settings2 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-tv-bg/95 backdrop-blur-lg border-t border-tv-border px-4 py-2 flex items-center justify-around max-w-md mx-auto select-none safe-area-pb">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-150 min-h-[44px] min-w-[50px] cursor-pointer ${
              isActive
                ? 'text-blue-500 font-semibold'
                : 'text-tv-textMuted hover:text-tv-textSecondary'
            }`}
          >
            <Icon className={`w-5 h-5 mb-1 transition-transform ${isActive ? 'scale-110' : 'scale-100'}`} />
            <span className="text-[10px] tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

