'use client';

import React from 'react';
import { Gamepad2, LayoutGrid, Search, Film } from 'lucide-react';

export type TabType = 'remote' | 'apps' | 'search' | 'media';

interface BottomNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'remote' as TabType, label: 'Remote', icon: Gamepad2 },
    { id: 'apps' as TabType, label: 'Apps', icon: LayoutGrid },
    { id: 'search' as TabType, label: 'Search', icon: Search },
    { id: 'media' as TabType, label: 'Media', icon: Film },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#10110E]/95 backdrop-blur-md border-t border-[#2A2C23] px-4 py-1.5 flex items-center justify-around max-w-md mx-auto select-none safe-area-pb">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all duration-150 min-h-[46px] min-w-[56px] cursor-pointer ${
              isActive
                ? 'text-[#F1EEE3] font-semibold'
                : 'text-[#737267] hover:text-[#A8A69A]'
            }`}
          >
            <Icon
              className={`w-5 h-5 mb-1 transition-transform ${
                isActive ? 'scale-105 text-[#B6AD83]' : 'scale-100 text-[#737267]'
              }`}
            />
            <span className="text-[10px] tracking-tight">{tab.label}</span>

            {/* Subtle Ivory/Olive Active Indicator Dot/Line */}
            {isActive && (
              <span className="absolute bottom-0 w-3 h-0.5 rounded-full bg-[#B6AD83]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
