'use client';

import { useEffect } from 'react';

export const PWARegister: React.FC = () => {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker after window loads for optimal initial page performance
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('[Lumina PWA] Service Worker registered with scope:', reg.scope);

            // Check for service worker updates
            reg.onupdatefound = () => {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      console.log('[Lumina PWA] New update available.');
                    }
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('[Lumina PWA] Service Worker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
};

