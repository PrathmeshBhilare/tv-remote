'use client';

import React, { useState } from 'react';

interface RemoteActionButtonProps {
  onClick: () => Promise<unknown> | void;
  onDisabledClick?: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'pad';
  disabled?: boolean;
  className?: string;
}

export const RemoteActionButton: React.FC<RemoteActionButtonProps> = ({
  onClick,
  onDisabledClick,
  children,
  ariaLabel,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  className = '',
}) => {
  const [isActive, setIsActive] = useState(false);

  const handlePress = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        // ignore
      }
    }

    setIsActive(true);
    setTimeout(() => setIsActive(false), 150);

    if (disabled) {
      if (onDisabledClick) {
        onDisabledClick();
      }
      return;
    }

    try {
      await onClick();
    } catch {
      // error handled in caller
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-tv-surface hover:bg-tv-surfaceHover active:bg-tv-surfaceActive text-tv-textPrimary border border-tv-border shadow-remoteButton';
      case 'accent':
        return 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-remoteButton font-semibold';
      case 'danger':
        return 'bg-tv-dangerMuted hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 border border-rose-500/30';
      case 'ghost':
        return 'bg-transparent hover:bg-tv-surfaceHover text-tv-textSecondary active:text-tv-textPrimary';
      case 'secondary':
      default:
        return 'bg-tv-surface/80 hover:bg-tv-surfaceHover active:bg-tv-surfaceActive text-tv-textPrimary border border-tv-border/80 shadow-remoteButton';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'h-11 w-11 min-h-[44px] min-w-[44px] text-xs';
      case 'lg':
        return 'h-16 w-16 min-h-[48px] min-w-[48px] text-lg';
      case 'pad':
        return 'h-14 w-14 min-h-[48px] min-w-[48px] text-base';
      case 'md':
      default:
        return 'h-12 w-12 min-h-[44px] min-w-[44px] text-sm';
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={handlePress}
      className={`relative inline-flex items-center justify-center rounded-2xl select-none transition-all duration-100 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${getVariantStyles()} ${getSizeStyles()} ${
        isActive ? 'scale-[0.92] brightness-125' : 'scale-100'
      } ${disabled ? 'opacity-40' : ''} ${className}`}
    >
      {children}
    </button>
  );
};
