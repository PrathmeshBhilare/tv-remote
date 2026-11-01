import type { Metadata, Viewport } from 'next';
import './globals.css';
import { TVProvider } from '../src/hooks/use-tv';
import { PWARegister } from '../components/pwa/PWARegister';

export const metadata: Metadata = {
  title: 'Lumina Remote | Smart webOS TV Controller',
  description:
    'Ultra-fast progressive web app remote for LG webOS Smart TVs. Control volume, navigation, channels, and YouTube directly from your phone.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lumina',
  },
  applicationName: 'Lumina Remote',
  keywords: ['LG TV Remote', 'webOS Remote', 'Smart TV Controller', 'PWA Remote', 'Lumina'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0B0E17',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="bg-tv-bg text-tv-textPrimary min-h-screen flex flex-col items-center justify-start antialiased selection:bg-cyan-500/20 selection:text-cyan-200">
        <PWARegister />
        <TVProvider>{children}</TVProvider>
      </body>
    </html>
  );
}
