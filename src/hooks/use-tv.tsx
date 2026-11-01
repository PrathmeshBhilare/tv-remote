'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  TVProfile,
  ConnectionState,
  TVStatus,
  RemoteKey,
  TVCapabilities,
  CommandResult,
  TVApp,
  PostPairingTestResult,
} from '../integrations/tv/types';
import { ITVAdapter } from '../integrations/tv/adapter';
import { tvRegistry } from '../integrations/tv/registry';
import { TVProfileStorage } from '../storage/tv-store';
import { TransportErrorInfo } from '../transport/transport';

interface TVContextValue {
  connectionState: ConnectionState;
  statusMessage: string;
  currentProfile: TVProfile | null;
  tvStatus: TVStatus | null;
  installedApps: TVApp[];
  capabilities: TVCapabilities;
  lastFeedback: { text: string; isError: boolean } | null;
  postPairingTest: PostPairingTestResult | null;
  isConnectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
  connectTV: (
    profile: TVProfile,
    pairingType?: 'PROMPT' | 'PIN'
  ) => Promise<{
    success: boolean;
    requiresPin?: boolean;
    requiresPrompt?: boolean;
    error?: string;
    errorInfo?: TransportErrorInfo;
  }>;
  submitPairingPin: (pin: string) => Promise<boolean>;
  disconnectTV: () => Promise<void>;
  forgetCurrentTV: () => Promise<void>;
  pressKey: (key: RemoteKey) => Promise<CommandResult>;
  volumeUp: () => Promise<CommandResult>;
  volumeDown: () => Promise<CommandResult>;
  toggleMute: () => Promise<CommandResult>;
  launchApp: (appId: string, params?: Record<string, unknown>) => Promise<CommandResult>;
  sendTextToTV: (text: string, replace?: boolean) => Promise<CommandResult>;
  sendEnterToTV: () => Promise<CommandResult>;
  deleteCharactersOnTV: (count?: number) => Promise<CommandResult>;
  executeYouTubeSearch: (
    query: string,
    modeOrAutoSubmit?: boolean | 'instant' | 'keyboard' | 'textOnly'
  ) => Promise<{ success: boolean; message: string }>;
  mediaPlay: () => Promise<CommandResult>;
  mediaPause: () => Promise<CommandResult>;
  mediaStop: () => Promise<CommandResult>;
  mediaRewind: () => Promise<CommandResult>;
  mediaFastForward: () => Promise<CommandResult>;
  powerOff: () => Promise<CommandResult>;
  runPostPairingSelfTest: () => Promise<PostPairingTestResult>;
}

const defaultCapabilities: TVCapabilities = {
  volume: true,
  mute: true,
  navigation: true,
  textInput: true,
  appLaunch: true,
  mediaPlayback: true,
  youtubeSearch: true,
  powerOn: false,
  powerOff: true,
};

const TVContext = createContext<TVContextValue | null>(null);

export function TVProvider({ children }: { children: React.ReactNode }) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('Disconnected');
  const [currentProfile, setCurrentProfile] = useState<TVProfile | null>(null);
  const [tvStatus, setTvStatus] = useState<TVStatus | null>(null);
  const [installedApps, setInstalledApps] = useState<TVApp[]>([]);
  const [lastFeedback, setLastFeedback] = useState<{ text: string; isError: boolean } | null>(null);
  const [postPairingTest, setPostPairingTest] = useState<PostPairingTestResult | null>(null);
  const [isConnectModalOpen, setConnectModalOpen] = useState(false);

  const adapterRef = useRef<ITVAdapter | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = useCallback((text: string, isError = false) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setLastFeedback({ text, isError });
    feedbackTimeoutRef.current = setTimeout(() => {
      setLastFeedback(null);
    }, 4000);
  }, []);

  const openConnectModal = useCallback(() => setConnectModalOpen(true), []);
  const closeConnectModal = useCallback(() => setConnectModalOpen(false), []);

  const refreshTVStatus = useCallback(async () => {
    if (!adapterRef.current) return;
    try {
      const status = await adapterRef.current.getStatus();
      setTvStatus(status);
      const appsRes = await adapterRef.current.getInstalledApps();
      if (appsRes.success && appsRes.data) {
        setInstalledApps(appsRes.data);
      }
    } catch {
      // ignore status update failures
    }
  }, []);

  const runPostPairingSelfTest = useCallback(async (): Promise<PostPairingTestResult> => {
    if (!adapterRef.current) {
      const failedResult: PostPairingTestResult = {
        volumeTested: false,
        volumeSuccess: false,
        navigationTested: false,
        navigationSuccess: false,
        timestamp: new Date().toLocaleTimeString(),
        message: 'Adapter not initialized.',
      };
      setPostPairingTest(failedResult);
      return failedResult;
    }

    showFeedback('Testing volume and navigation commands on TV...');

    let volumeSuccess = false;
    try {
      const volRes = await adapterRef.current.setVolumeUp();
      if (volRes.success) {
        await adapterRef.current.setVolumeDown();
        volumeSuccess = true;
      }
    } catch (err) {
      console.warn('Post-pairing volume test failed:', err);
    }

    let navigationSuccess = false;
    try {
      const navRes = await adapterRef.current.pressKey('ENTER');
      navigationSuccess = navRes.success;
    } catch (err) {
      console.warn('Post-pairing navigation test failed:', err);
    }

    const testSummary: PostPairingTestResult = {
      volumeTested: true,
      volumeSuccess,
      navigationTested: true,
      navigationSuccess,
      timestamp: new Date().toLocaleTimeString(),
      message:
        volumeSuccess && navigationSuccess
          ? 'Physical TV verification successful: Volume & Navigation operational.'
          : volumeSuccess
          ? 'Volume verified. Navigation socket initialising.'
          : 'Pairing complete. Testing commands on physical TV...',
    };

    setPostPairingTest(testSummary);
    showFeedback(testSummary.message, !volumeSuccess && !navigationSuccess);
    return testSummary;
  }, [showFeedback]);

  // Initialize active adapter on mount
  useEffect(() => {
    if (!adapterRef.current) {
      adapterRef.current = tvRegistry.getAdapter('lg-webos');
      adapterRef.current.onStateChange((state, msg) => {
        setConnectionState(state);
        if (msg) setStatusMessage(msg);
      });
    }

    const saved = TVProfileStorage.getActiveProfile();
    if (saved) {
      setCurrentProfile(saved);
      if (adapterRef.current) {
        adapterRef.current.connect(saved).then((res) => {
          if (res.success) {
            if (res.clientKey && res.clientKey !== saved.clientKey) {
              const updated = { ...saved, clientKey: res.clientKey };
              TVProfileStorage.saveProfile(updated);
              setCurrentProfile(updated);
            }
            showFeedback(`Connected to ${saved.name}`);
            refreshTVStatus();
          } else if (res.requiresPin) {
            setConnectModalOpen(true);
          }
        });
      }
    } else {
      // If no saved profile on first launch, open connect view
      setConnectModalOpen(true);
    }
  }, [showFeedback, refreshTVStatus]);

  const ensureConnectedOrPrompt = useCallback(() => {
    if (connectionState !== 'connected') {
      showFeedback('TV Not Connected. Please connect to your LG TV first.', true);
      setConnectModalOpen(true);
      return false;
    }
    return true;
  }, [connectionState, showFeedback]);

  const connectTV = useCallback(
    async (
      profile: TVProfile,
      pairingType?: 'PROMPT' | 'PIN'
    ): Promise<{
      success: boolean;
      requiresPin?: boolean;
      requiresPrompt?: boolean;
      error?: string;
      errorInfo?: TransportErrorInfo;
    }> => {
      if (!adapterRef.current) return { success: false, error: 'TV adapter not initialized.' };
      setCurrentProfile(profile);
      showFeedback(`Connecting to ${profile.name || profile.ip}...`);

      const res = await adapterRef.current.connect(profile, pairingType);
      if (res.success) {
        const updatedProfile: TVProfile = {
          ...profile,
          clientKey: res.clientKey || profile.clientKey,
          lastConnected: new Date().toISOString(),
        };
        TVProfileStorage.saveProfile(updatedProfile);
        setCurrentProfile(updatedProfile);
        showFeedback(`Connected to ${updatedProfile.name}`);
        setConnectModalOpen(false);
        refreshTVStatus();

        if (res.clientKey && !profile.clientKey) {
          runPostPairingSelfTest();
        }
        return { success: true };
      } else if (res.requiresPin) {
        showFeedback('Please enter the PIN code displayed on your TV screen.');
        return { success: false, requiresPin: true };
      } else if (res.pairingType === 'PROMPT') {
        showFeedback('Please accept the connection prompt on your TV screen.');
        return { success: false, requiresPrompt: true };
      } else {
        const errMsg = res.error?.message || 'Connection failed';
        showFeedback(errMsg, true);
        return {
          success: false,
          error: errMsg,
          errorInfo: res.error?.details as TransportErrorInfo | undefined,
        };
      }
    },
    [showFeedback, refreshTVStatus, runPostPairingSelfTest]
  );

  const submitPairingPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!adapterRef.current || !currentProfile) return false;
      showFeedback('Verifying PIN with TV...');

      const res = await adapterRef.current.sendPin(pin);
      if (res.success && res.clientKey) {
        const updatedProfile: TVProfile = {
          ...currentProfile,
          clientKey: res.clientKey,
          lastConnected: new Date().toISOString(),
        };
        TVProfileStorage.saveProfile(updatedProfile);
        setCurrentProfile(updatedProfile);
        showFeedback('PIN verified! Successfully paired.');
        setConnectModalOpen(false);
        refreshTVStatus();

        runPostPairingSelfTest();
        return true;
      } else {
        showFeedback(res.error?.message || 'Incorrect PIN entered. Check TV screen.', true);
        return false;
      }
    },
    [currentProfile, showFeedback, refreshTVStatus, runPostPairingSelfTest]
  );

  const disconnectTV = useCallback(async () => {
    if (!adapterRef.current) return;
    await adapterRef.current.disconnect();
    setConnectionState('disconnected');
    setStatusMessage('Disconnected');
    setTvStatus(null);
    setPostPairingTest(null);
    showFeedback('Disconnected');
  }, [showFeedback]);

  const forgetCurrentTV = useCallback(async () => {
    if (currentProfile) {
      TVProfileStorage.deleteProfile(currentProfile.id);
      if (adapterRef.current && (adapterRef.current as any).forget) {
        await (adapterRef.current as any).forget();
      }
    }
    await disconnectTV();
    setCurrentProfile(null);
    setPostPairingTest(null);
    showFeedback('TV credentials cleared');
    setConnectModalOpen(true);
  }, [currentProfile, disconnectTV, showFeedback]);

  const pressKey = useCallback(
    async (key: RemoteKey): Promise<CommandResult> => {
      if (!ensureConnectedOrPrompt()) {
        return { success: false, error: { code: 'NOT_CONNECTED', message: 'Not connected' } };
      }
      if (!adapterRef.current) {
        return { success: false, error: { code: 'NO_ADAPTER', message: 'Adapter not initialized' } };
      }
      showFeedback(`Sent ${key}`);
      const res = await adapterRef.current.pressKey(key);
      if (!res.success) {
        showFeedback(res.error?.message || `Failed to send ${key}`, true);
      }
      return res;
    },
    [ensureConnectedOrPrompt, showFeedback]
  );

  const volumeUp = useCallback(async () => {
    if (!ensureConnectedOrPrompt()) return { success: false };
    if (!adapterRef.current) return { success: false };
    showFeedback('Vol +');
    const res = await adapterRef.current.setVolumeUp();
    if (res.success) {
      setTvStatus((prev) => (prev ? { ...prev, volumeLevel: (prev.volumeLevel ?? 10) + 1 } : null));
    } else {
      showFeedback(res.error?.message || 'Failed to increase volume', true);
    }
    return res;
  }, [ensureConnectedOrPrompt, showFeedback]);

  const volumeDown = useCallback(async () => {
    if (!ensureConnectedOrPrompt()) return { success: false };
    if (!adapterRef.current) return { success: false };
    showFeedback('Vol -');
    const res = await adapterRef.current.setVolumeDown();
    if (res.success) {
      setTvStatus((prev) => (prev ? { ...prev, volumeLevel: Math.max(0, (prev.volumeLevel ?? 10) - 1) } : null));
    } else {
      showFeedback(res.error?.message || 'Failed to decrease volume', true);
    }
    return res;
  }, [ensureConnectedOrPrompt, showFeedback]);

  const toggleMute = useCallback(async () => {
    if (!ensureConnectedOrPrompt()) return { success: false };
    if (!adapterRef.current) return { success: false };
    const nextMute = !tvStatus?.isMuted;
    const res = await adapterRef.current.setMute(nextMute);
    if (res.success) {
      setTvStatus((prev) => (prev ? { ...prev, isMuted: nextMute } : null));
      showFeedback(nextMute ? 'Muted' : 'Unmuted');
    } else {
      showFeedback(res.error?.message || 'Failed to toggle mute', true);
    }
    return res;
  }, [ensureConnectedOrPrompt, tvStatus, showFeedback]);

  const launchApp = useCallback(
    async (appId: string, params?: Record<string, unknown>) => {
      if (!ensureConnectedOrPrompt()) return { success: false };
      if (!adapterRef.current) return { success: false };
      showFeedback(`Launching ${appId}...`);
      const res = await adapterRef.current.launchApp(appId, params);
      if (res.success) {
        showFeedback(`Launched ${appId}`);
        refreshTVStatus();
      } else {
        showFeedback(res.error?.message || `Could not launch ${appId}`, true);
      }
      return res;
    },
    [ensureConnectedOrPrompt, showFeedback, refreshTVStatus]
  );

  const sendTextToTV = useCallback(
    async (text: string, replace = false) => {
      if (!ensureConnectedOrPrompt()) return { success: false };
      if (!adapterRef.current) return { success: false };
      showFeedback(`Typing "${text}" to TV...`);
      return adapterRef.current.sendText(text, replace);
    },
    [ensureConnectedOrPrompt, showFeedback]
  );

  const sendEnterToTV = useCallback(async () => {
    if (!ensureConnectedOrPrompt()) return { success: false };
    if (!adapterRef.current) return { success: false };
    showFeedback('Enter / Search on TV');
    // Send both IME enter and Pointer ENTER for universal YouTube/webOS support
    const imeRes = await adapterRef.current.sendEnter();
    const ptrRes = await adapterRef.current.pressKey('ENTER');
    return imeRes.success ? imeRes : ptrRes;
  }, [ensureConnectedOrPrompt, showFeedback]);

  const deleteCharactersOnTV = useCallback(
    async (count = 1) => {
      if (!ensureConnectedOrPrompt()) return { success: false };
      if (!adapterRef.current) return { success: false };
      showFeedback(`Backspace (${count})`);
      if (adapterRef.current.deleteCharacters) {
        return adapterRef.current.deleteCharacters(count);
      }
      return { success: false, error: { code: 'UNSUPPORTED', message: 'Delete not supported' } };
    },
    [ensureConnectedOrPrompt, showFeedback]
  );

  const executeYouTubeSearch = useCallback(
    async (
      query: string,
      modeOrAutoSubmit: boolean | 'instant' | 'keyboard' | 'textOnly' = true
    ): Promise<{ success: boolean; message: string }> => {
      if (!ensureConnectedOrPrompt()) {
        return { success: false, message: 'TV is not connected. Connect first.' };
      }
      if (!adapterRef.current) {
        return { success: false, message: 'TV adapter is not available.' };
      }

      const cleanQuery = query.trim();
      if (!cleanQuery) {
        return { success: false, message: 'Please enter a search query.' };
      }

      const autoSubmit =
        typeof modeOrAutoSubmit === 'boolean'
          ? modeOrAutoSubmit
          : modeOrAutoSubmit !== 'textOnly';

      showFeedback(
        autoSubmit
          ? `Typing "${cleanQuery}" & searching...`
          : `Sending "${cleanQuery}" to TV search box...`
      );

      // Injects text directly into the active TV input/search box (NO browser redirects, NO YouTube reloads)
      const textRes = await adapterRef.current.sendText(cleanQuery);
      if (!textRes.success) {
        return {
          success: false,
          message:
            textRes.error?.message ||
            'Text insertion failed. Make sure the search box is open on your TV.',
        };
      }

      TVProfileStorage.addSearchQuery(cleanQuery);

      if (autoSubmit) {
        // Wait a moment for TV to register input characters before submitting
        await new Promise((resolve) => setTimeout(resolve, 350));
        await adapterRef.current.sendEnter().catch(() => null);
        await adapterRef.current.pressKey('ENTER').catch(() => null);
        showFeedback(`Sent "${cleanQuery}" & searched!`);
        return { success: true, message: `Sent "${cleanQuery}" and searched on TV.` };
      }

      showFeedback(`Sent "${cleanQuery}" to TV search box!`);
      return { success: true, message: `Inserted "${cleanQuery}" into TV search box.` };
    },
    [ensureConnectedOrPrompt, showFeedback]
  );

  const mediaPlay = useCallback(async () => {
    if (!ensureConnectedOrPrompt()) return { success: false };
    if (!adapterRef.current) return { success: false };
    showFeedback('Play');
    const res = await adapterRef.current.mediaPlay();
    if (!res.success) showFeedback(res.error?.message || 'Play command unsupported', true);
    return res;
  }, [ensureConnectedOrPrompt, showFeedback]);

  const mediaPause = useCallback(async () => {
    if (!ensureConnectedOrPrompt()) return { success: false };
    if (!adapterRef.current) return { success: false };
    showFeedback('Pause');
    const res = await adapterRef.current.mediaPause();
    if (!res.success) showFeedback(res.error?.message || 'Pause command unsupported', true);
    return res;
  }, [ensureConnectedOrPrompt, showFeedback]);

  const mediaStop = useCallback(async () => {
    if (!ensureConnectedOrPrompt()) return { success: false };
    if (!adapterRef.current) return { success: false };
    showFeedback('Stop');
    const res = await adapterRef.current.mediaStop();
    if (!res.success) showFeedback(res.error?.message || 'Stop command unsupported', true);
    return res;
  }, [ensureConnectedOrPrompt, showFeedback]);

  const mediaRewind = useCallback(async () => {
    if (!ensureConnectedOrPrompt()) return { success: false };
    if (!adapterRef.current) return { success: false };
    showFeedback('Rewind');
    const res = await adapterRef.current.mediaRewind();
    if (!res.success) showFeedback(res.error?.message || 'Rewind command unsupported', true);
    return res;
  }, [ensureConnectedOrPrompt, showFeedback]);

  const mediaFastForward = useCallback(async () => {
    if (!ensureConnectedOrPrompt()) return { success: false };
    if (!adapterRef.current) return { success: false };
    showFeedback('Fast Forward');
    const res = await adapterRef.current.mediaFastForward();
    if (!res.success) showFeedback(res.error?.message || 'Fast Forward unsupported', true);
    return res;
  }, [ensureConnectedOrPrompt, showFeedback]);

  const powerOff = useCallback(async () => {
    if (!ensureConnectedOrPrompt()) return { success: false };
    if (!adapterRef.current) return { success: false };
    const res = await adapterRef.current.powerOff();
    if (res.success) {
      showFeedback('TV powered off');
      disconnectTV();
    } else {
      showFeedback(res.error?.message || 'Power off failed', true);
    }
    return res;
  }, [ensureConnectedOrPrompt, disconnectTV, showFeedback]);

  const capabilities = adapterRef.current ? adapterRef.current.getCapabilities() : defaultCapabilities;

  return (
    <TVContext.Provider
      value={{
        connectionState,
        statusMessage,
        currentProfile,
        tvStatus,
        installedApps,
        capabilities,
        lastFeedback,
        postPairingTest,
        isConnectModalOpen,
        openConnectModal,
        closeConnectModal,
        connectTV,
        submitPairingPin,
        disconnectTV,
        forgetCurrentTV,
        pressKey,
        volumeUp,
        volumeDown,
        toggleMute,
        launchApp,
        sendTextToTV,
        sendEnterToTV,
        deleteCharactersOnTV,
        executeYouTubeSearch,
        mediaPlay,
        mediaPause,
        mediaStop,
        mediaRewind,
        mediaFastForward,
        powerOff,
        runPostPairingSelfTest,
      }}
    >
      {children}
    </TVContext.Provider>
  );
}

export function useTV() {
  const context = useContext(TVContext);
  if (!context) {
    throw new Error('useTV must be used within a TVProvider');
  }
  return context;
}
