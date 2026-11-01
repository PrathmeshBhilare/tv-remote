# LG Smart TV Remote --- Product & Technical Plan

**Document version:** 1.0\
**Date:** 31 October 2026\
**Status:** Product plan / implementation brief\
**Initial target:** LG Smart TVs running webOS\
**Future target:** Additional TV platforms through independent adapters

------------------------------------------------------------------------

## 1. Product overview

Build a mobile-first Smart TV remote that lets a user control an LG
webOS television from a phone connected to the same local network.

The product will initially focus on:

1.  TV pairing and reconnection.
2.  Volume up/down and mute.
3.  Directional navigation, OK, Back and Home.
4.  Launching YouTube and Netflix where supported.
5.  YouTube search using the phone keyboard: type a query, press Enter,
    and have the text submitted to the YouTube search field on the TV.
6.  YouTube and Netflix playback controls where the TV/app exposes
    compatible commands.
7.  Connection status, saved TV details and clear error feedback.

The product should have a shared remote interface and a platform-adapter
architecture so other TV brands can be added later without rewriting the
UI.

### Product positioning

A practical, mobile-first remote for supported Smart TVs. Do not market
it as universally compatible or promise every feature on every model.
Capabilities vary by TV model, webOS version, app version, pairing
permissions and network conditions.

------------------------------------------------------------------------

## 2. Goals and non-goals

### MVP goals

-   Connect to one LG webOS TV on the same local network.
-   Complete the TV's on-screen pairing/authorization process.
-   Persist the authorized client key securely for future sessions.
-   Send real volume and navigation commands.
-   Launch YouTube and Netflix if their app IDs are discoverable and
    launch is permitted.
-   Type into the active YouTube search field and submit with Enter, on
    tested models.
-   Show actual command success/failure and connection state.
-   Work well on mobile Chrome and as an installable PWA where browser
    capabilities permit.

### Not MVP goals

-   Guaranteed support for every LG model or every webOS release.
-   Guaranteed Netflix in-app search or deep playback integration.
-   Guaranteed power-on from standby.
-   Screen mirroring or casting.
-   Changing every picture, sound, network or system setting.
-   A cloud server that remotely controls a TV over the internet.
-   Multi-user accounts, subscriptions or analytics before core control
    works.

------------------------------------------------------------------------

## 3. User journeys

### First-time connection

1.  User opens the web app while the phone and TV are on the same
    Wi-Fi/LAN.
2.  User selects **Add TV**.
3.  App attempts discovery where the runtime supports it.
4.  If discovery is unavailable, user enters the TV's local IP address
    manually.
5.  App tests the connection and identifies the available SSAP
    transport/port.
6.  App starts registration/pairing.
7.  TV displays an authorization prompt; user accepts it using the
    physical remote.
8.  App receives the client key and stores it using the safest available
    platform storage.
9.  App verifies the session by requesting a harmless status value.
10. App opens the Remote screen.

### Returning connection

1.  User opens the app.
2.  App loads the saved TV profile.
3.  App reconnects using the saved authorization key.
4.  App verifies the connection and displays Connected / Disconnected.
5.  If the key is rejected, app offers a clear re-pair flow.

### YouTube search from phone

1.  User taps YouTube Search in the remote app.
2.  App launches YouTube if it is not already open.
3.  App guides or navigates the TV to YouTube's search field using
    supported remote keys.
4.  User types on the phone.
5.  User taps the app's Search/Enter button or the keyboard's submit
    action.
6.  Integration sends text to the active TV input field using the
    supported webOS text-input mechanism.
7.  Integration sends Enter/submit.
8.  TV displays YouTube search results.
9.  App reports success only when the relevant commands have been
    accepted; do not claim that results loaded unless observable state
    confirms it.

**Important:** Text injection normally requires the target input field
to be focused. The implementation must not assume that typing text
automatically opens or focuses YouTube search. Build a tested sequence
for supported YouTube versions, with a manual-focus fallback and visible
instructions.

------------------------------------------------------------------------

## 4. Feature scope and acceptance criteria

  -----------------------------------------------------------------------
  Feature                 MVP acceptance criteria Important limitations
  ----------------------- ----------------------- -----------------------
  Pairing                 TV authorization prompt Exact
                          appears; accepted key   handshake/permissions
                          is retained and reused  vary

  Reconnect               Reconnects without      TV/network must be
                          repeating pairing when  reachable
                          key remains valid       

  Volume                  Volume up/down and mute Requires supported SSAP
                          work on test TV         methods

  Navigation              Up/down/left/right, OK, Pointer input socket
                          Back, Home work         may be required

  Launch YouTube          App launches using app  App may be absent or
                          ID discovered from TV   restricted

  Launch Netflix          App launches using app  App may be absent or
                          ID discovered from TV   restricted

  YouTube search          Phone text is inserted  App version/focus
                          into focused TV search  behaviour must be
                          field; Enter submits    tested

  YouTube playback        Play/pause and          App may expose limited
                          supported media keys    control
                          work                    

  Netflix playback        Test play/pause/seek    DRM app may ignore or
                          using supported         restrict commands
                          remote/media keys       

  Power off               Works if supported by   Standby power-on is
                          TV/API                  separate

  Power on                Attempt Wake-on-LAN     Requires MAC address
                          only when configured    and TV setting
                          and supported           

  Device status           UI shows actual         Do not infer success
                          connection state and    from button press
                          last error              
  -----------------------------------------------------------------------

### Priority order

**P0 --- Required for first usable build** - Pairing and saved
authorization. - Connection state and reconnect. - Volume and mute. -
D-pad, OK, Back and Home.

**P1 --- Core product differentiators** - Launch YouTube and Netflix. -
Phone-to-TV YouTube text input and Enter. - YouTube playback controls. -
Search history.

**P2 --- Improvements** - Touchpad/pointer mode. - Voice-to-text using
the phone's keyboard microphone. - Power-on via Wake-on-LAN when
supported. - Multiple saved LG TVs. - App shortcuts and input switching.

------------------------------------------------------------------------

## 5. Technical architecture

### High-level design

``` text
Mobile browser / installed PWA
          |
          v
Next.js + React UI (Vercel)
          |
          v
Remote command interface
          |
          v
Transport layer
   |                 |
   |                 +--> Native Android networking adapter (fallback)
   |
   +--> Browser WebSocket transport (prove on target browser)
          |
          v
LG webOS adapter
          |
          v
SSAP WebSocket / pointer input socket
          |
          v
LG webOS TV on local network
```

### Critical networking decision

The Vercel deployment serves the UI; it does not act as a proxy into the
user's home network. A serverless Vercel function cannot directly reach
a private TV IP address on the user's LAN.

A browser may be able to open a WebSocket directly to the TV, but
browser security rules, HTTPS-to-insecure-WebSocket mixed-content
restrictions, local-network access policies and self-signed TLS
certificates can block or complicate this. Test this in the target
mobile browser before committing to a browser-only product.

Implement a **transport abstraction** so the product is not locked to
one networking approach:

-   **Transport A --- Browser direct:** The browser connects directly to
    the TV's SSAP WebSocket. Use only after a real-device proof of
    concept succeeds on supported browsers.
-   **Transport B --- Native Android companion/container:** Keep the
    Next.js UI, but package it in an Android shell (for example,
    Capacitor) and use a native networking plugin for local
    WebSocket/TLS connections. This is the preferred fallback if browser
    networking is unreliable.
-   **Transport C --- Local bridge:** Optional desktop/home-network
    service for users who want a separate bridge. It must be explicitly
    installed and paired; it is not a Vercel cloud proxy.

Do not spend time building all transports at once. Prove Transport A
first. If it fails on the target browser/TV combination, document the
exact failure and implement Transport B.

### Frontend

-   Next.js (App Router)
-   React + TypeScript
-   Tailwind CSS
-   Lucide icons
-   Framer Motion only for purposeful transitions
-   PWA manifest and service worker for installability, with offline UI
    shell only
-   No database/backend required for the first local-control MVP

### LG integration

-   SSAP WebSocket client.
-   Pairing/registration handshake and client-key management.
-   Request/response correlation using message IDs.
-   Pointer input socket for remote button presses where required.
-   App discovery and app launching using IDs returned by the TV.
-   Status subscriptions only where supported and useful.
-   Transport selection between `ws` and secure `wss` based on
    model/firmware support, not blind assumptions.

Commonly encountered SSAP endpoints are port 3000 (plain WebSocket) and
port 3001 (secure WebSocket), but the actual model/firmware must be
tested. Some recent models require secure transport.

### Future adapters

``` text
src/
  integrations/
    tv/
      contracts/
      registry/
    lg-webos/
    samsung-tizen/
    android-tv/
    roku/
```

Do not implement the other adapters in the LG MVP. Define the shared
contract now and add real adapters later.

------------------------------------------------------------------------

## 6. Suggested project structure

``` text
lg-smart-remote/
├── app/
│   ├── page.tsx
│   ├── connect/
│   │   └── page.tsx
│   ├── remote/
│   │   └── page.tsx
│   ├── search/
│   │   └── page.tsx
│   ├── devices/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── connection/
│   │   ├── DeviceDiscovery.tsx
│   │   ├── ManualIpEntry.tsx
│   │   ├── PairingStatus.tsx
│   │   └── ConnectionBadge.tsx
│   ├── remote/
│   │   ├── NavigationPad.tsx
│   │   ├── VolumeControl.tsx
│   │   ├── RemoteActionButton.tsx
│   │   ├── Touchpad.tsx
│   │   └── MediaControls.tsx
│   ├── search/
│   │   ├── YouTubeSearchInput.tsx
│   │   └── SearchHistory.tsx
│   └── layout/
├── src/
│   ├── integrations/
│   │   ├── tv/
│   │   │   ├── types.ts
│   │   │   ├── adapter.ts
│   │   │   └── registry.ts
│   │   └── lg-webos/
│   │       ├── lg-adapter.ts
│   │       ├── ssap-client.ts
│   │       ├── pairing.ts
│   │       ├── pointer-client.ts
│   │       ├── commands.ts
│   │       ├── app-discovery.ts
│   │       └── capabilities.ts
│   ├── transport/
│   │   ├── transport.ts
│   │   ├── browser-websocket.ts
│   │   └── native-transport.ts
│   ├── hooks/
│   ├── stores/
│   ├── storage/
│   └── utils/
├── public/
│   ├── manifest.json
│   └── icons/
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
│   ├── supported-models.md
│   ├── protocol-notes.md
│   └── test-results.md
├── .env.example
├── README.md
└── package.json
```

The native transport folder can remain an interface/stub until the
browser proof of concept is complete. Do not create fake native
functionality.

------------------------------------------------------------------------

## 7. Integration design

### Shared TV adapter contract

The UI must not send raw SSAP method names. It calls a typed adapter
API, for example:

``` ts
interface TVAdapter {
  connect(): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  getStatus(): Promise<TVStatus>;
  setVolumeUp(): Promise<CommandResult>;
  setVolumeDown(): Promise<CommandResult>;
  setMute(muted: boolean): Promise<CommandResult>;
  pressKey(key: RemoteKey): Promise<CommandResult>;
  launchApp(app: TVApp): Promise<CommandResult>;
  sendText(text: string): Promise<CommandResult>;
  sendEnter(): Promise<CommandResult>;
  getCapabilities(): TVCapabilities;
}
```

Use typed result objects. Every command should return a success/failure
result with a useful error code and message.

### Pairing and authorization

-   Use the actual SSAP registration manifest and permission list
    required for pointer/keyboard control.
-   Show clear instructions to accept the prompt on the TV.
-   Store the client key as a secret.
-   In a browser-only prototype, localStorage is not ideal for long-term
    secrets; use the best available secure storage and clearly document
    the risk.
-   In a native Android container, prefer Android Keystore-backed
    storage.
-   Never log or expose client keys in console output, analytics, error
    reports or UI.
-   Provide a Forget TV / Re-pair action.
-   Never bypass the TV's authorization prompt.

### App discovery and launching

-   Query the TV for installed/available apps.
-   Use the app IDs returned by the TV; do not hardcode IDs as the only
    source of truth.
-   Build a friendly mapping for YouTube and Netflix.
-   If an app is not present or cannot be launched, show a clear
    unsupported/unavailable state.

### YouTube search

Implement this as a stateful workflow, not as a blind text command:

1.  Ensure the TV is connected.
2.  Launch YouTube if necessary.
3.  Move focus to the YouTube search control using tested navigation
    steps, or instruct the user to focus it manually.
4.  Send text through the supported keyboard/text-input mechanism.
5.  Send Enter.
6.  Report command acknowledgement separately from confirmed search
    results.

Add a manual fallback: show "Open YouTube Search on your TV, then tap
Send Search" if automatic focus detection is unavailable.

Keep a short search history locally. Allow clearing it.

### Netflix

-   Launch Netflix if installed.
-   Use standard navigation keys.
-   Test media key behaviour on the target TV.
-   Do not assume Netflix exposes a public search API or accepts the
    same text/media commands as YouTube.
-   Label unsupported controls honestly.

------------------------------------------------------------------------

## 8. UI/UX specification

### Visual direction

-   Premium, restrained dark interface.
-   High contrast and large touch targets.
-   Mobile-first, one-handed operation.
-   Minimal visual clutter.
-   Clear connected/disconnected state.
-   Avoid excessive gradients, glass effects and decorative animation.
-   Use subtle motion only to communicate interaction and state.

### Screens

**A. Connect TV** - Product mark/name. - Discover TVs button. - Manual
IP entry. - Discovered device list. - Pairing instructions. - Connection
test and error state.

**B. Main Remote** - Connected TV name. - Connection indicator. - Large
directional pad with OK. - Home and Back. - Volume plus/minus and
mute. - YouTube and Netflix quick launch. - Tabs or navigation to Search
and Media.

**C. YouTube Search** - Large text input. - Send Search / Enter
button. - Clear input. - Search history. - Connection status. - "Focus
the YouTube search field on TV" fallback instructions.

**D. Media** - Play/pause. - Stop where supported. - Seek forward/back
where supported. - App context and unsupported-state messaging.

**E. Devices and Settings** - Saved TVs. - Reconnect. -
Forget/re-pair. - Troubleshooting. - About and supported capabilities.

### Accessibility and interaction

-   Minimum comfortable touch targets around 44--48 CSS pixels.
-   Visible focus states.
-   Accessible labels for icon-only controls.
-   Haptic feedback only if native runtime supports it.
-   Prevent accidental repeated commands from rapid taps.
-   Support portrait layout first; landscape may be an enhancement.

------------------------------------------------------------------------

## 9. Security and privacy

-   Local-network control only; no remote internet control in MVP.
-   Pair only after explicit user action and TV-side approval.
-   Keep client keys out of logs and telemetry.
-   Do not send TV credentials or keys to Vercel.
-   Use secure storage where available.
-   Validate manually entered IP addresses.
-   Restrict requests to private/local network targets expected for the
    TV.
-   Protect against arbitrary URL input and SSRF if a bridge is ever
    added.
-   Do not expose an unauthenticated local bridge on the network.
-   No analytics containing search text or TV identifiers by default.
-   Provide a clear way to forget the TV and delete local credentials.

------------------------------------------------------------------------

## 10. Error handling

Handle at least these cases:

-   TV not found.
-   Wrong IP address.
-   Phone and TV are on different networks or guest Wi-Fi isolation is
    enabled.
-   TV is off or in standby.
-   SSAP port unavailable.
-   Browser blocks the WebSocket connection.
-   TLS/self-signed certificate issue.
-   Pairing prompt not accepted or timed out.
-   Client key rejected.
-   Pointer socket unavailable.
-   App not installed.
-   YouTube search field not focused.
-   Text input unsupported by the current app version.
-   Netflix ignores media command.
-   TV disconnects while a command is in progress.

Display actionable explanations rather than generic "Something went
wrong" messages.

------------------------------------------------------------------------

## 11. Testing strategy

### Phase 0: Real-device technical spike

Before building the full UI:

1.  Record the LG model number and webOS version.
2.  Confirm phone and TV are on the same network.
3.  Find the TV IP address.
4.  Test SSAP connection from the intended Android phone/browser.
5.  Confirm the TV pairing prompt appears.
6.  Pair and save a test key.
7.  Send one volume command.
8.  Open the pointer socket and send one navigation key.
9.  Test secure port requirements and browser restrictions.
10. Test text insertion into a focused YouTube search field and Enter.

**Go/no-go:** If direct browser transport cannot reliably connect on the
target phone/browser/TV, do not hack around browser security settings
for end users. Move to the native Android networking fallback while
retaining the Next.js UI.

### Unit tests

-   SSAP message construction.
-   Message ID correlation.
-   Pairing state machine.
-   Error mapping.
-   App ID mapping.
-   Command result handling.
-   Text input validation.

### Integration tests on physical TV

-   Pair and reconnect.
-   Volume up/down/mute.
-   D-pad and OK.
-   Home and Back.
-   Launch YouTube.
-   Focus YouTube search.
-   Send text and Enter.
-   Launch Netflix.
-   Test play/pause/seek.
-   Disconnect/reconnect.
-   Test TV standby and wake behaviour separately.

### Acceptance test checklist

-   [ ] User can pair with the LG TV.
-   [ ] Pairing key is not exposed in logs.
-   [ ] App reconnects after refresh/reopen.
-   [ ] Volume buttons work on the physical TV.
-   [ ] Navigation buttons work on the physical TV.
-   [ ] YouTube launches.
-   [ ] User can enter a search query on the phone.
-   [ ] Pressing Search/Enter submits text to YouTube on the TV.
-   [ ] Unsupported YouTube focus behaviour has a manual fallback.
-   [ ] Netflix launches if installed.
-   [ ] Netflix controls show accurate capability feedback.
-   [ ] Disconnection and errors are understandable.
-   [ ] PWA installation does not falsely imply unsupported networking
    works.

------------------------------------------------------------------------

## 12. Development milestones

  -----------------------------------------------------------------------
  Milestone               Deliverable             Exit condition
  ----------------------- ----------------------- -----------------------
  M0                      LG model +              Pairing and a real
                          browser/network proof   command work
                          of concept              

  M1                      Next.js project and     Responsive screens
                          design system           render

  M2                      SSAP client and pairing Pair/reconnect works

  M3                      Remote controls         Volume and navigation
                                                  work

  M4                      App discovery and       YouTube/Netflix launch
                          launching               where installed

  M5                      YouTube phone keyboard  Text + Enter works on
                          search                  target TV

  M6                      Media controls          Verified supported
                                                  controls work

  M7                      PWA, persistence and    Reliable reconnect and
                          hardening               error states

  M8                      Multi-TV profile and    More than one LG TV
                          documentation           profile supported

  M9                      New brand adapter       Only after LG MVP is
                                                  stable
  -----------------------------------------------------------------------

Do not estimate a fixed launch date until M0 has been completed on the
actual TV.

------------------------------------------------------------------------

## 13. Deployment plan

### Web UI

-   Deploy the Next.js frontend to Vercel.
-   Configure production and preview environments.
-   Use HTTPS.
-   Keep secrets out of client-side environment variables.
-   Do not put TV pairing keys in Vercel environment variables.

### Local control

-   Browser direct mode: connect from the client device to the TV only
    if the target browser permits it.
-   Native Android fallback: package the same UI with a native
    networking bridge/plugin.
-   Optional local bridge: a separately installed service, not a Vercel
    function.

### PWA

-   Add manifest, icons and install instructions.
-   Cache static UI assets only.
-   Do not claim remote commands work offline.
-   Re-check local network permissions after installation.

------------------------------------------------------------------------

## 14. Expansion to other TV brands

Keep the common interface separate from brand-specific code.

Future adapters:

-   Android TV / Google TV.
-   Samsung Tizen.
-   Roku.
-   Other platforms only after protocol and hardware validation.

Each adapter must declare capabilities such as:

``` ts
type TVCapabilities = {
  volume: boolean;
  mute: boolean;
  navigation: boolean;
  textInput: boolean;
  appLaunch: boolean;
  mediaPlayback: boolean;
  youtubeSearch: boolean;
  powerOn: boolean;
  powerOff: boolean;
};
```

The UI must hide or disable unavailable functions based on the selected
TV's reported/tested capabilities.

------------------------------------------------------------------------

## 15. Risks and mitigations

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Unknown LG model/webOS version      Make model/version capture the
                                      first task

  Browser blocks local WebSocket      Prove direct mode early; retain
                                      native fallback

  Secure WebSocket certificate issue  Test target firmware; implement
                                      safe certificate handling in native
                                      layer

  Pairing permissions incomplete      Use tested registration manifest
                                      and least required permissions

  Pointer socket unavailable          Test pointer permissions and
                                      fallback navigation

  YouTube search focus changes        Use focus workflow plus manual
                                      fallback

  Netflix restricts media controls    Test real app; label unsupported
                                      functions

  Power-on unavailable                Treat Wake-on-LAN as optional and
                                      model/settings dependent

  TV firmware changes                 Keep adapter isolated and add
                                      regression tests

  Client key leakage                  Secure storage, redaction and
                                      Forget TV
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 16. Definition of done for the first release

The first release is complete only when all of the following are true on
the user's actual LG TV:

1.  The app connects and pairs.
2.  It reconnects without pairing every time.
3.  Volume and navigation work.
4.  YouTube and Netflix launch when installed.
5.  YouTube search text can be entered from the phone and submitted with
    Enter.
6.  Netflix controls are tested and accurately described.
7.  Failures are visible and actionable.
8.  The chosen deployment/runtime works without asking users to disable
    browser security protections.
9.  Pairing secrets are not exposed.
10. The README explains model requirements, setup and known limitations.

------------------------------------------------------------------------

# Appendix A --- Technical references

Use these as starting points. Community projects are implementation
references, not official guarantees of support.

-   LG webOS TV developer documentation:
    https://webostv.developer.lge.com/
-   LG Magic Remote documentation:
    https://webostv.developer.lge.com/develop/guides/magic-remote
-   SSAP protocol implementation reference:
    https://github.com/d-gubert/lgtv-remote
-   Browser-based LG remote example:
    https://github.com/MysterWolf/lg-remote
-   LG webOS remote integration notes:
    https://github.com/jxgedouard/remote-me/blob/main/docs/lg-webos.md
-   Connect SDK webOS capability reference:
    https://connectsdk.com/en/latest/apis-and/and-webostvservice.html

Confirm protocol details against the target TV before relying on any
community implementation.

------------------------------------------------------------------------

# Appendix B --- Prompt for Antigravity

Paste the following prompt into Antigravity after creating/opening the
project repository.

## Role

Act as a senior full-stack engineer with practical experience in
Next.js, TypeScript, browser networking, WebSocket protocols, mobile PWA
development and LG webOS second-screen integrations.

## Project

Build **LG Smart TV Remote**, a premium mobile-first web application for
controlling LG webOS TVs over the local network.

Read the complete `Plan.md` before writing code. Treat it as the source
of truth. Do not skip the technical proof of concept or invent
successful TV control.

## Core stack

-   Next.js App Router
-   React
-   TypeScript
-   Tailwind CSS
-   Lucide icons
-   Framer Motion for restrained interaction feedback
-   Vercel for frontend hosting
-   LG webOS SSAP WebSocket integration
-   A transport abstraction that allows browser direct mode and a future
    native Android networking layer

Do not add a database or cloud backend unless a specific requirement
justifies it. TV control is local-network communication.

## Non-negotiable engineering requirements

1.  Inspect the existing repository before changing anything.
2.  If the repository is empty, scaffold the project cleanly.
3.  If code already exists, preserve useful work and avoid destructive
    rewrites.
4.  Read `Plan.md` and create a milestone checklist.
5.  Implement one milestone at a time.
6.  Use real typed integrations, not mock buttons presented as working
    controls.
7.  Never fake connection status, pairing success, command
    acknowledgements or TV state.
8.  Never expose or log pairing keys.
9.  Do not put TV secrets in Vercel environment variables.
10. Do not claim all LG TVs are supported before testing the actual
    model.
11. Do not bypass browser security or tell end users to disable browser
    security settings.
12. Keep LG-specific protocol code isolated from UI components.
13. Every button must have loading, success/failure or unsupported
    feedback as appropriate.
14. Write a README with setup, test procedure and known limitations.

## Step 1 --- Inspect and report

Before coding:

-   Inspect files and package configuration.
-   Identify existing framework and conventions.
-   Read `Plan.md`.
-   Identify missing project information.
-   Create `docs/IMPLEMENTATION_STATUS.md` with milestones and
    checkboxes.
-   Report the proposed implementation sequence.
-   Do not ask for information that can be deferred, but mark the LG
    model and webOS version as required for physical integration
    testing.

## Step 2 --- Technical proof of concept

Prioritize a minimal LG webOS SSAP proof of concept before polishing the
interface.

Implement:

-   SSAP transport interface.
-   Browser WebSocket transport attempt.
-   Pairing/registration handshake.
-   Request/response message IDs and timeouts.
-   Client-key reuse.
-   Connection lifecycle and cleanup.
-   Pointer input socket if the TV grants it.
-   One volume command and one navigation command.

Test browser restrictions explicitly. HTTPS-to-plain-WS mixed content,
local-network access policy and TV self-signed TLS may prevent direct
browser communication. Do not silently claim compatibility.

If browser direct mode fails on the target runtime, stop and document
the exact failure. Keep the UI and adapter interfaces intact, then
implement the native Android transport fallback (for example, a
Capacitor Android shell with a native WebSocket/TLS plugin). Do not
build a remote Vercel proxy to private LAN addresses.

## Step 3 --- Build the UI

Create a polished, mobile-first dark interface with:

-   Connect TV screen.
-   Device selection and manual IP entry.
-   Pairing instructions.
-   Main remote with large directional pad.
-   Volume and mute controls.
-   Home and Back.
-   YouTube and Netflix launch buttons.
-   Dedicated YouTube search screen.
-   Media controls.
-   Saved devices/settings.
-   Connection status and actionable errors.

Use a restrained premium visual system. Avoid generic AI-generated
dashboard styling, excessive gradients, giant rounded cards and
unnecessary animations. Prioritize usability, clear hierarchy and
one-handed mobile interaction.

## Step 4 --- Implement LG adapter

Create a typed `TVAdapter` interface and LG webOS adapter.

The LG adapter should handle:

-   Connection and disconnection.
-   Pairing and saved client key.
-   Status query.
-   Volume up/down and mute.
-   Navigation keys.
-   Pointer socket where required.
-   Installed app discovery.
-   App launching using app IDs returned by the TV.
-   Text insertion and Enter.
-   Media commands where supported.
-   Capability reporting.

Use the TV's discovered app IDs. Do not assume hardcoded IDs work on
every model.

## Step 5 --- YouTube phone-to-TV search

Implement this exact user journey:

1.  User taps YouTube Search.
2.  App launches YouTube if needed.
3.  App navigates to or asks the user to focus the YouTube search field.
4.  User types on the phone.
5.  User taps Search/Enter.
6.  App sends text to the active TV input field.
7.  App sends Enter.
8.  App displays the actual command result.

Do not assume YouTube search is focused. Provide a clear manual-focus
fallback if automatic focus cannot be verified. Keep text input and
Enter as separate commands so failures can be diagnosed.

## Step 6 --- Netflix and media

-   Launch Netflix if installed.
-   Implement navigation.
-   Test play/pause/seek using the actual TV/app.
-   Report unsupported commands clearly.
-   Do not invent a Netflix search API or claim full in-app control.

## Step 7 --- Quality and delivery

-   Add unit tests for protocol messages, pairing states and error
    mapping.
-   Add integration test instructions for a physical LG TV.
-   Add reconnect and timeout handling.
-   Verify mobile responsive behaviour.
-   Add PWA metadata and installability.
-   Ensure no mock implementation is shown as real functionality.
-   Run lint, type-check and build.
-   Fix errors before reporting completion.
-   Update `docs/IMPLEMENTATION_STATUS.md` and README.

## Expected deliverables

-   Working Next.js project.
-   Clean component and integration architecture.
-   LG webOS SSAP adapter.
-   Pairing and connection workflow.
-   Remote control UI.
-   YouTube search workflow.
-   Netflix launch and verified supported controls.
-   PWA configuration.
-   Tests and physical-device test instructions.
-   README.
-   Updated implementation status and known limitations.

## Working style

Work in small, verifiable milestones. After each milestone:

1.  List files created/changed.
2.  Explain what works.
3.  Explain what has not been tested.
4.  List errors or blockers.
5.  Give the exact next command or action needed.

Do not claim the app controls a real TV until a physical LG TV has been
paired and the commands have been verified.
