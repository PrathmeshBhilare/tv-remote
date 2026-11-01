import type { Metadata, Viewport } from 'next';
import './globals.css';
import { TVProvider } from '../src/hooks/use-tv';
import { PWARegister } from '../components/pwa/PWARegister';

export const metadata: Metadata = {
  title: 'LG Control | Smart TV Remote',
  description:
    'Premium Smart TV Remote for LG webOS TVs. Elegant volume, navigation, quick apps, and typing control.',
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
    title: 'LG Control',
  },
  applicationName: 'LG Control',
  keywords: ['LG Control', 'LG TV Remote', 'webOS Remote', 'Smart TV Controller', 'PWA Remote'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#10110E',
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
      <body className="bg-tv-bg text-tv-textPrimary min-h-screen flex flex-col items-center justify-start antialiased selection:bg-[#B6AD83]/20 selection:text-[#F1EEE3]">
        <PWARegister />
        <TVProvider>{children}</TVProvider>
      </body>
    </html>
  );
}
