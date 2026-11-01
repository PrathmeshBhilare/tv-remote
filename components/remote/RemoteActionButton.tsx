'use client';

import React, { useState } from 'react';

interface RemoteActionButtonProps {
  onClick: () => Promise<unknown> | void;
  onDisabledClick?: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'dpad';
  size?: 'sm' | 'md' | 'lg' | 'pad' | 'pill';
  disabled?: boolean;
  className?: string;
  active?: boolean;
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
  active = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // ignore
      }
    }

    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 140);

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
        return 'bg-[#25261F] hover:bg-[#2C2E25] active:bg-[#1C1D17] text-[#F1EEE3] border border-[#36382E] shadow-remoteButton';
      case 'accent':
        return 'bg-[#B6AD83] hover:bg-[#C4BB91] active:bg-[#9E956C] text-[#10110E] font-semibold shadow-remoteButton border border-[#D5CBA8]/40';
      case 'danger':
        return 'bg-[#25261F] hover:bg-[#C95D53]/20 active:bg-[#C95D53]/30 text-[#C95D53] border border-[#C95D53]/30';
      case 'dpad':
        return 'bg-transparent hover:bg-[#25261F]/60 active:bg-[#25261F] text-[#A8A69A] active:text-[#F1EEE3] transition-colors';
      case 'ghost':
        return 'bg-transparent hover:bg-[#191A15] active:bg-[#25261F] text-[#A8A69A] active:text-[#F1EEE3] border border-transparent';
      case 'secondary':
      default:
        return 'bg-[#191A15] hover:bg-[#20221B] active:bg-[#25261F] text-[#F1EEE3] border border-[#2A2C23] shadow-remoteButton';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'h-10 w-10 min-h-[40px] min-w-[40px] text-xs';
      case 'lg':
        return 'h-16 w-16 min-h-[48px] min-w-[48px] text-lg';
      case 'pad':
        return 'h-14 w-14 min-h-[48px] min-w-[48px] text-base';
      case 'pill':
        return 'h-11 px-4 min-h-[44px] text-xs font-medium';
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
      disabled={disabled}
      className={`relative inline-flex items-center justify-center rounded-2xl select-none transition-all duration-100 ease-out cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${getVariantStyles()} ${getSizeStyles()} ${
        isPressed || active ? 'scale-[0.96] brightness-90 shadow-remoteButtonActive' : 'hover:scale-[1.01]'
      } ${className}`}
    >
      {children}
    </button>
  );
};
