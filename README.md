# LG Control — Smart TV Remote

A premium, mobile-first Progressive Web App (PWA) and remote controller for LG webOS Smart TVs. Built with **Next.js 14**, **React 18**, **TypeScript**, and **Tailwind CSS**.

---

## 1. Architecture Overview

### Why a Local Bridge is Required for Deployed Web Apps

When this application is deployed to **Vercel on public HTTPS** (`https://tv-remote-roan.vercel.app`), modern web browsers enforce two strict security boundaries:

1. **Untrusted Self-Signed Certificate (`NET::ERR_CERT_AUTHORITY_INVALID`):**
   LG webOS TVs use an internal, self-signed TLS certificate on port `3001` (`wss://`). Browsers abort direct WebSocket connections from public HTTPS origins to untrusted local certificates.
2. **Private Network Access (PNA):**
   Modern Chromium browsers restrict public websites from opening raw sockets to private local IP addresses (`192.168.x.x`) without valid preflight responses.

To solve this, LG Control provides a **secure local bridge** service that runs on your local network:

```
[ Deployed App (Vercel) ] ────────────────────────┐
   (https://tv-remote-roan.vercel.app)            │
                     │                            │
                     ▼ (CORS + PNA preflight)     ▼ (Localhost only)
            [ Local Bridge Service ]     [ Direct Browser Mode ]
             (npm run bridge: 3005)       (when run on localhost:3000)
                     │
                     ▼ (TOFU SHA-256 TLS Pinning)
           [ LG webOS Smart TV ]
             (192.168.1.10:3001)
```

---

## 2. Quick Start Guide

### Step 1: Start the Local Bridge (On PC / Mac on the same Wi-Fi)

In your terminal, run:

```bash
npm run bridge
```

This starts the secured bridge service on `http://127.0.0.1:3005`:
- **Trust-on-First-Use (TOFU) TLS Verification:** Validates that the TV's certificate is issued by LG Electronics Inc. and pins its SHA-256 fingerprint in `.tv-fingerprints.json`.
- **Private Network Access:** Returns `Access-Control-Allow-Private-Network: true` to satisfy Chrome's PNA security model.
- **Local Token Authentication:** Auto-provisions and validates security tokens via `.bridge-token`.

### Step 2: Open LG Control

- **On Desktop:** Open [https://tv-remote-roan.vercel.app](https://tv-remote-roan.vercel.app) or `http://localhost:3000`. The app will automatically detect the bridge running on `http://127.0.0.1:3005`.
- **On Mobile (Phone):** Because your phone is a separate device from your computer, open Settings in the app and set the bridge address to your computer's local Wi-Fi IP (e.g. `http://192.168.1.15:3005`).

### Step 3: Connect & Control

1. Tap **Connect & Pair with TV**.
2. Look at your TV screen for the 8-digit code (if first time pairing).
3. Enter the 8 digits into the app — the client key is saved for automatic reconnects.
4. Enjoy full remote functionality: Volume, Directional D-Pad, OK, YouTube Search & Text Typing, Netflix, and Media Controls.

---

## 3. Scripts Reference

| Command | Description |
|---|---|
| `npm run bridge` | Starts the secured local bridge service on port 3005 |
| `npm run dev` | Starts local Next.js development server on port 3000 |
| `npm run build` | Generates optimized production build (static + dynamic routes) |
| `npm test` | Runs the full automated unit test suite (13 tests) |
| `npm run cap:sync` | Syncs web assets to Capacitor Android project |
| `npm run cap:android` | Opens native Android project in Android Studio |

---

## 4. Security & Privacy

- **No Third-Party Cloud Relays:** All TV commands and credentials are kept strictly inside your local home Wi-Fi network.
- **Client-Key Protection:** Pairing keys are stored locally on your device in `.tv-keys.json` and never exposed in logs.
- **Certificate Pinning:** The bridge pins the TV's certificate SHA-256 fingerprint on first contact, preventing MITM attacks.

---

## 5. Physical TV Verified Capabilities

Tested and verified against physical LG webOS Smart TV (`192.168.1.10:3001`):

- **Power Off:** Fully operational (`ssap://system/turnOff`).
- **Volume & Mute:** Real-time volume step adjustments (`ssap://audio/volumeUp`, `ssap://audio/volumeDown`).
- **Navigation D-Pad:** Directional arrows and central `OK / Enter` button.
- **YouTube App Launch:** 1-tap launch of native YouTube leanback TV application.
- **YouTube Text Typing:** Direct text insertion into TV search box without browser redirects (`ssap://com.webos.service.ime/insertText`).
- **Media Playback:** Play, Pause, Rewind, Fast Forward, and Stop.

---

## 6. Standalone Android App (APK) — No Computer / Laptop Needed

If you want to operate your LG TV directly from your mobile phone with your laptop **completely closed or turned off**:

1. **Download the APK:**
   - Go to the GitHub repository's **Releases** or **Actions** tab.
   - Download the latest **`LG-Control.apk`**.
2. **Install on Your Phone:**
   - Open the downloaded `.apk` file on your Android phone and tap **Install** (allow "Install from unknown sources" if prompted).
3. **Control Your TV:**
   - Ensure your phone is connected to the same Wi-Fi as your LG TV.
   - Open **LG Control** on your phone.
   - Enter your TV IP (`192.168.1.10`) and tap **Connect**.
   - Your phone uses its native OkHttp WebSocket bridge to connect directly to the TV over Wi-Fi — zero bridge and zero laptop needed!
