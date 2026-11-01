# Physical LG TV Integration Test Protocol & Verification Sheet

Use this worksheet to test and verify the remote against your physical LG Smart TV.

## Test Environment Setup
- **Target LG TV Model:** `[To be filled by tester, e.g. OLED65C2PUA / 55UQ7500]`
- **webOS Version:** `[e.g. webOS 7.2 (22), webOS 23, webOS 24]`
- **TV IP Address:** `[e.g. 192.168.1.150]`
- **Network Setup:** Phone and LG TV connected to the same 2.4GHz / 5GHz Wi-Fi (AP isolation disabled)
- **Client Runtime:** Mobile Chrome (Android) / Chrome PWA / Safari iOS

---

## Verification Test Matrix

| Test ID | Feature | Steps | Expected Result | Physical Result |
|---|---|---|---|---|
| **TC-01A** | On-Screen Prompt Pairing | Select Prompt mode in Connect, tap Connect & Pair | TV displays prompt: "LG Smart Remote requests access". Accepting saves client-key. | `[Pass / Fail]` |
| **TC-01B** | Numeric PIN-Based Pairing | Select PIN mode in Connect, tap Connect & Pair | TV displays 8-digit PIN on screen; app presents PIN entry view; entering correct PIN completes registration. | `[Pass / Fail]` |
| **TC-01C** | Invalid PIN Error Handling | Enter wrong PIN (e.g. 00000000) | App shows error: "Incorrect PIN entered. Check TV screen and try again." | `[Pass / Fail]` |
| **TC-02** | Reconnect / Session Reuse | Refresh web app or reopen PWA | App reconnects automatically using saved client-key without re-prompting on TV screen. | `[Pass / Fail]` |
| **TC-03** | Volume Up & Down | Tap `+` and `-` on Volume rocker | TV volume increases/decreases on screen; UI volume counter increments. | `[Pass / Fail]` |
| **TC-04** | Mute Toggle | Tap Mute button | TV mutes/unmutes; button changes state. | `[Pass / Fail]` |
| **TC-05** | D-Pad Navigation | Press UP, DOWN, LEFT, RIGHT, OK | Active UI selection moves on TV; OK activates selection. | `[Pass / Fail]` |
| **TC-06** | Back & Home | Press Back and Home buttons | Back returns to previous screen; Home opens webOS dashboard/launcher. | `[Pass / Fail]` |
| **TC-07** | YouTube Launch | Tap YouTube shortcut | YouTube app launches on the TV screen. | `[Pass / Fail]` |
| **TC-08** | Netflix Launch | Tap Netflix shortcut | Netflix app launches on the TV screen. | `[Pass / Fail]` |
| **TC-09** | YouTube Keyboard Search | Open Search tab, type query (e.g. "4K Nature"), tap **Send & Search on TV** | Text is inserted into active YouTube search bar on TV and submitted with Enter. | `[Pass / Fail]` |
| **TC-10** | Media Controls | Play, Pause, Fast-forward, Rewind in YouTube | Video pauses/plays accordingly on TV. | `[Pass / Fail]` |
| **TC-11** | Forget TV | In Devices & Settings, tap Forget TV | Profile and stored client-key are removed; reconnection requires re-pairing. | `[Pass / Fail]` |
| **TC-12** | Power Off | Tap Power Off button | TV displays powering off notification and turns off. | `[Pass / Fail]` |
| **TC-13** | Automated Post-Pairing Self-Test | Complete pairing via Prompt or PIN | App automatically runs non-destructive volume and navigation test against TV; displays verification status pill. | `[Pass / Fail]` |

---

## Browser Restrictions Diagnostic Checklist
- [ ] If connecting via `https://` hosted deployment fails:
  - Check browser console for mixed-content warning (`Mixed Content: The page was loaded over HTTPS, but requested an insecure WebSocket...`).
  - **Remedy:** Load via local HTTP / localhost, install as PWA, or build native Capacitor Android wrapper.
- [ ] If connecting on Port 3001 fails:
  - Check if self-signed TV TLS certificate was rejected by browser.
  - **Remedy:** Test port 3000 (`ws://`) or trust the TV certificate in browser settings.

