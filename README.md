# Lumina Remote — Smart webOS TV Controller

A sleek, mobile-first Progressive Web App (PWA) and web controller for LG webOS Smart TVs. Built with **Next.js 14 (App Router)**, **React 18**, **TypeScript**, and **Tailwind CSS**.

---

## Features

- **PWA Ready**: Installable on Android (via Chrome) and iPhone/iPad (via Safari "Add to Home Screen"). Works offline and in standalone full-screen mode.
- **Starting Splash Screen**: Ambient glowing startup animation with a custom neon loading spinner.
- **Smart Mobile Install Banner**: Detects standalone mode automatically and prompts mobile users with step-by-step installation instructions until installed.
- **YouTube Video Search & Direct Play**: Search YouTube videos on your phone and tap any result to launch and play directly in the native YouTube TV app. Includes embedded D-Pad navigation for the on-screen TV keyboard.
- **TV Pairing & Auto-Reconnect**: Supports both PIN-code and on-screen Prompt pairing. Securely retains pairing client keys locally for zero-friction instant reconnection.
- **Precision Volume & Mute**: Responsive volume rocker (`+` / `-`) and mute toggle with live feedback.
- **Directional Navigation**: Large circular D-Pad (Up, Down, Left, Right, OK) with dedicated Back and Home buttons backed by the webOS pointer input socket.
- **App Quick Launch**: Discovers installed apps and launches YouTube, Netflix, and other webOS apps with status feedback.
- **Local Network Privacy**: Communicates locally over Wi-Fi directly between your device and TV. No keys, searches, or TV commands are ever sent to third-party cloud servers.

---

## Technical Architecture

```text
Mobile PWA / Browser Shell
          │
          ▼
Next.js 14 App Router + React UI (Lumina)
          │
          ▼
Shared TV Adapter Interface (ITVAdapter)
          │
    ┌─────┴─────────────────────────────────┐
    ▼                                       ▼
LG webOS Adapter                      Future TV Adapters
(LGWebOSTVAdapter)                (Samsung, Roku, Android TV)
    │
    ▼
Transport Abstraction (ITransportConnection)
    │
    ├──► Local Server Bridge (/api/tv/bridge on Node.js)
    ├──► Direct Browser WebSocket Transport (wss:// / ws://)
    └──► Native Transport (Capacitor/Cordova fallback)
    │
    ▼
LG Smart TV (webOS SSAP on Port 3000 / 3001)
```

---

## Quick Start

### 1. Prerequisites
- Node.js >= 18.x
- Phone/PC and LG Smart TV connected to the **same local Wi-Fi network**.

### 2. Installation
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open **http://localhost:3000** on your phone or PC.

### 4. Run Tests & Build
```bash
npm test
npm run build
```

---

## Deploying to Vercel

1. Push your repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Vercel automatically deploys with HTTPS enabled, allowing mobile users to install the PWA directly onto their device.

---

## License

MIT
