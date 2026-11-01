import { ITVAdapter } from '../tv/adapter';
import {
  TVProfile,
  ConnectionResult,
  TVStatus,
  CommandResult,
  RemoteKey,
  TVApp,
  TVCapabilities,
  ConnectionState,
} from '../tv/types';
import { SSAPClient } from './ssap-client';
import { PointerClient } from './pointer-client';
import { LG_SSAP_URIS } from './commands';
import { ITransportConnection, TransportError } from '../../transport/transport';
import { NativeAndroidTransport } from '../../transport/native-transport';
import { BrowserWebSocketTransport } from '../../transport/browser-websocket';
import { TVProfileStorage } from '../../storage/tv-store';

async function safeParseJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned HTTP ${res.status}`);
  }
}

function isPrivateLanIp(ip: string): boolean {
  if (!ip) return false;
  return (
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.endsWith('.local')
  );
}

function isCloudEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || isPrivateLanIp(host)) {
    return false;
  }
  return true;
}

function getEffectiveBridgeUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const configured = TVProfileStorage.getBridgeUrl();
  if (configured) {
    const base = configured.trim().replace(/\/+$/, '');
    return base.endsWith('/api/tv/bridge') ? base : `${base}/api/tv/bridge`;
  }
  if (!isCloudEnvironment()) {
    return '/api/tv/bridge';
  }
  return null;
}

export class LGWebOSTVAdapter implements ITVAdapter {
  public readonly brand = 'LG webOS';
  private ssapClient: SSAPClient;
  private pointerClient: PointerClient;
  private currentProfile: TVProfile | null = null;
  private stateListeners = new Set<(state: ConnectionState, message?: string) => void>();
  private hasCustomTransport: boolean;
  private usingBridge = false;

  constructor(transportFactory?: () => ITransportConnection) {
    this.hasCustomTransport = Boolean(transportFactory);

    const defaultFactory = () => {
      if (NativeAndroidTransport.isAvailable()) {
        return new NativeAndroidTransport();
      }
      return new BrowserWebSocketTransport();
    };

    const effectiveFactory = transportFactory || defaultFactory;

    this.ssapClient = new SSAPClient({
      transportFactory: effectiveFactory,
      onStateChange: (state, message) => {
        this.notifyStateChange(state, message);
      },
    });
    this.pointerClient = new PointerClient(effectiveFactory);
  }

  public onStateChange(listener: (state: ConnectionState, message?: string) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyStateChange(state: ConnectionState, message?: string) {
    this.stateListeners.forEach((fn) => {
      try {
        fn(state, message);
      } catch (err) {
        console.error('Error in state listener:', err);
      }
    });
  }

  public async connect(profile: TVProfile, preferredPairingType?: 'PROMPT' | 'PIN'): Promise<ConnectionResult> {
    this.currentProfile = {
      ...profile,
      port: profile.port || 3001,
      useSecureWs: typeof profile.useSecureWs === 'boolean' ? profile.useSecureWs : true,
    };

    const port = this.currentProfile.port || 3001;
    const pairingMode = preferredPairingType || profile.pairingType || 'PIN';
    const bridgeUrl = getEffectiveBridgeUrl();

    // 1. If running with a local bridge (localhost or configured bridge service) without custom mock transport:
    if (typeof window !== 'undefined' && !this.hasCustomTransport && bridgeUrl) {
      try {
        this.usingBridge = true;
        this.notifyStateChange('connecting', `Connecting to ${profile.name || profile.ip} via local bridge...`);

        const bridgeRes = await fetch(bridgeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'connect',
            ip: profile.ip,
            port,
            useSecureWs: true,
            clientKey: profile.clientKey,
            pairingType: pairingMode,
          }),
        });

        const data = await safeParseJson(bridgeRes);

        if (data.requiresPin) {
          this.notifyStateChange('pairing_pin', 'Enter the PIN displayed on your TV screen.');
          return { success: false, requiresPin: true, pairingType: 'PIN' };
        }

        if (data.requiresPrompt) {
          this.notifyStateChange('pairing_prompt', 'Press "Allow" on your TV screen.');
          return { success: false, pairingType: 'PROMPT' };
        }

        if (data.success && data.clientKey) {
          if (this.currentProfile) {
            this.currentProfile.clientKey = data.clientKey;
          }
          this.notifyStateChange('connected', 'Connected to TV');
          return { success: true, clientKey: data.clientKey };
        }

        if (data.error) {
          console.warn('Local bridge returned error, falling back to direct client connection:', data.error);
        }
      } catch (bridgeErr) {
        console.warn('Local bridge connection failed, falling back to direct client connection:', bridgeErr);
      }
    }

    // 2. Direct client-side transport (used for cloud deployments, native Android wrappers, and browser direct mode)
    this.usingBridge = false;
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const protocol = isHttps ? 'wss' : (profile.useSecureWs ? 'wss' : 'ws');
    const url = `${protocol}://${profile.ip}:${port}`;

    try {
      this.notifyStateChange('connecting', `Connecting to TV at ${profile.ip}...`);
      const reg = await this.ssapClient.connect(url, profile.clientKey, pairingMode);

      if (reg.requiresPin) {
        this.notifyStateChange('pairing_pin', 'Enter the PIN displayed on your TV screen.');
        return { success: false, requiresPin: true, pairingType: 'PIN' };
      }

      if (reg.clientKey) {
        if (this.currentProfile) {
          this.currentProfile.clientKey = reg.clientKey;
        }

        // Initialize pointer client for navigation buttons asynchronously
        this.ssapClient
          .request<{ socketPath?: string }>(LG_SSAP_URIS.GET_POINTER_INPUT_SOCKET, undefined, 2000)
          .then((ptrRes) => {
            if (ptrRes?.socketPath) {
              return this.pointerClient.connect(ptrRes.socketPath);
            }
          })
          .catch(() => {
            // Pointer socket will be connected on demand by pressKey if needed
          });

        this.notifyStateChange('connected', 'Connected to TV');
        return { success: true, clientKey: reg.clientKey };
      }

      this.notifyStateChange('connected', 'Connected to TV');
      return { success: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Connection failed';
      const errCode = err instanceof TransportError ? err.code : 'CONNECTION_FAILED';
      const details = err instanceof TransportError ? err.info : undefined;

      this.notifyStateChange('error', errMsg);
      return {
        success: false,
        error: {
          code: errCode,
          message: errMsg,
          details,
        },
      };
    }
  }

  public async sendPin(pin: string): Promise<ConnectionResult> {
    if (!this.currentProfile) {
      return { success: false, error: { code: 'NO_PROFILE', message: 'No TV selected' } };
    }

    if (this.usingBridge) {
      const bridgeUrl = getEffectiveBridgeUrl() || '/api/tv/bridge';
      try {
        this.notifyStateChange('connecting', 'Verifying PIN with TV...');
        const res = await fetch(bridgeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sendPin',
            ip: this.currentProfile.ip,
            port: this.currentProfile.port || 3001,
            useSecureWs: true,
            pin: pin.trim(),
          }),
        });

        const data = await safeParseJson(res);
        if (data.success && data.clientKey) {
          if (this.currentProfile) {
            this.currentProfile.clientKey = data.clientKey;
          }
          this.notifyStateChange('connected', 'PIN verified! TV paired successfully.');
          return { success: true, clientKey: data.clientKey };
        }

        const errMsg = data.error?.message || 'Incorrect PIN entered. Check TV screen.';
        this.notifyStateChange('pairing_pin', errMsg);
        return { success: false, error: { code: 'INCORRECT_PIN', message: errMsg } };
      } catch (err) {
        return {
          success: false,
          error: { code: 'PIN_FAILED', message: err instanceof Error ? err.message : 'PIN submission failed' },
        };
      }
    }

    // Direct SSAP client
    try {
      this.notifyStateChange('connecting', 'Verifying PIN with TV...');
      const res = await this.ssapClient.sendPin(pin);
      if (res.clientKey) {
        if (this.currentProfile) {
          this.currentProfile.clientKey = res.clientKey;
        }

        // Initialize pointer socket for navigation asynchronously
        this.ssapClient
          .request<{ socketPath?: string }>(LG_SSAP_URIS.GET_POINTER_INPUT_SOCKET, undefined, 2000)
          .then((ptrRes) => {
            if (ptrRes?.socketPath) {
              return this.pointerClient.connect(ptrRes.socketPath);
            }
          })
          .catch(() => {
            // Pointer socket will be connected on demand by pressKey if needed
          });

        this.notifyStateChange('connected', 'PIN verified! TV paired successfully.');
        return { success: true, clientKey: res.clientKey };
      }
      return { success: true, clientKey: res.clientKey };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Incorrect PIN entered. Check TV screen.';
      const errCode = err instanceof TransportError ? err.code : 'INCORRECT_PIN';
      const details = err instanceof TransportError ? err.info : undefined;

      this.notifyStateChange('pairing_pin', errMsg);
      return {
        success: false,
        error: { code: errCode, message: errMsg, details },
      };
    }
  }

  private async callBridge(action: string, extra: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.currentProfile) throw new Error('No active TV profile');
    const bridgeUrl = getEffectiveBridgeUrl() || '/api/tv/bridge';
    const res = await fetch(bridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        ip: this.currentProfile.ip,
        port: this.currentProfile.port || 3001,
        useSecureWs: true,
        clientKey: this.currentProfile.clientKey,
        ...extra,
      }),
    });
    const json = await safeParseJson(res);
    if (!json.success) {
      throw new Error(json.error?.message || 'Command failed on TV');
    }
    return json.data;
  }

  public async disconnect(): Promise<void> {
    try {
      await this.pointerClient.disconnect();
      await this.ssapClient.disconnect();
    } catch {}
    this.currentProfile = null;
  }

  public async forget(): Promise<void> {
    if (this.currentProfile) {
      const bridgeUrl = getEffectiveBridgeUrl() || '/api/tv/bridge';
      try {
        await fetch(bridgeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'forget',
            ip: this.currentProfile.ip,
            port: this.currentProfile.port || 3001,
          }),
        });
      } catch {}
    }
    await this.disconnect();
  }

  public async getStatus(): Promise<TVStatus> {
    return {
      connected: true,
      connectionState: 'connected',
      modelName: this.currentProfile?.name || 'LG Smart TV',
    };
  }

  public async setVolumeUp(): Promise<CommandResult> {
    if (this.usingBridge) {
      try {
        await this.callBridge('command', { uri: LG_SSAP_URIS.VOLUME_UP });
        return { success: true };
      } catch (err) {
        return { success: false, error: { code: 'VOLUME_UP_FAILED', message: err instanceof Error ? err.message : 'Failed' } };
      }
    }

    try {
      await this.ssapClient.request(LG_SSAP_URIS.VOLUME_UP);
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: 'VOLUME_UP_FAILED', message: err instanceof Error ? err.message : 'Failed' } };
    }
  }

  public async setVolumeDown(): Promise<CommandResult> {
    if (this.usingBridge) {
      try {
        await this.callBridge('command', { uri: LG_SSAP_URIS.VOLUME_DOWN });
        return { success: true };
      } catch (err) {
        return { success: false, error: { code: 'VOLUME_DOWN_FAILED', message: err instanceof Error ? err.message : 'Failed' } };
      }
    }

    try {
      await this.ssapClient.request(LG_SSAP_URIS.VOLUME_DOWN);
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: 'VOLUME_DOWN_FAILED', message: err instanceof Error ? err.message : 'Failed' } };
    }
  }

  public async setMute(muted: boolean): Promise<CommandResult> {
    if (this.usingBridge) {
      try {
        await this.callBridge('command', { uri: LG_SSAP_URIS.SET_MUTE, payload: { mute: muted } });
        return { success: true };
      } catch (err) {
        return { success: false, error: { code: 'SET_MUTE_FAILED', message: err instanceof Error ? err.message : 'Failed' } };
      }
    }

    try {
      await this.ssapClient.request(LG_SSAP_URIS.SET_MUTE, { mute: muted });
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: 'SET_MUTE_FAILED', message: err instanceof Error ? err.message : 'Failed' } };
    }
  }

  public async pressKey(key: RemoteKey): Promise<CommandResult> {
    if (this.usingBridge) {
      try {
        await this.callBridge('pointerButton', { key });
        return { success: true };
      } catch (err) {
        return { success: false, error: { code: 'KEY_FAILED', message: err instanceof Error ? err.message : 'Key failed' } };
      }
    }

    if (this.pointerClient.isConnected()) {
      return this.pointerClient.sendButton(key);
    }

    // Try connecting pointer input socket on demand if not already connected
    try {
      const ptrRes = await this.ssapClient.request<{ socketPath?: string }>(LG_SSAP_URIS.GET_POINTER_INPUT_SOCKET);
      if (ptrRes?.socketPath) {
        await this.pointerClient.connect(ptrRes.socketPath);
        if (this.pointerClient.isConnected()) {
          return this.pointerClient.sendButton(key);
        }
      }
    } catch {}

    if (key === 'ENTER') {
      try {
        await this.ssapClient.request(LG_SSAP_URIS.SEND_ENTER_KEY);
        return { success: true };
      } catch (err) {
        return { success: false, error: { code: 'ENTER_FAILED', message: 'Enter key failed' } };
      }
    }

    return { success: true };
  }

  public async getInstalledApps(): Promise<CommandResult<TVApp[]>> {
    if (this.usingBridge) {
      try {
        interface AppListResponse {
          apps?: Array<{ id: string; title: string; largeIcon?: string; icon?: string }>;
          launchPoints?: Array<{ id: string; title: string; largeIcon?: string; icon?: string }>;
        }
        const rawRes = await this.callBridge('command', { uri: LG_SSAP_URIS.LIST_LAUNCH_POINTS }).catch(() =>
          this.callBridge('command', { uri: LG_SSAP_URIS.LIST_APPS })
        );
        const res = (rawRes || {}) as AppListResponse;
        const rawList = res.launchPoints || res.apps || [];
        return {
          success: true,
          data: rawList.map((item) => ({ id: item.id, title: item.title, iconUrl: item.icon })),
        };
      } catch {
        return {
          success: true,
          data: [
            { id: 'youtube.leanback.v4', title: 'YouTube' },
            { id: 'netflix', title: 'Netflix' },
          ],
        };
      }
    }

    try {
      const res = await this.ssapClient.request<{ launchPoints?: Array<{ id: string; title: string }> }>(
        LG_SSAP_URIS.LIST_LAUNCH_POINTS
      );
      const list = res.launchPoints || [];
      return {
        success: true,
        data: list.map((item) => ({ id: item.id, title: item.title })),
      };
    } catch {
      return { success: true, data: [] };
    }
  }

  public async launchApp(appId: string, params?: Record<string, unknown>): Promise<CommandResult> {
    if (this.usingBridge) {
      try {
        await this.callBridge('command', { uri: LG_SSAP_URIS.LAUNCH_APP, payload: { id: appId, ...params } });
        return { success: true };
      } catch (err) {
        return { success: false, error: { code: 'LAUNCH_FAILED', message: err instanceof Error ? err.message : 'Launch failed' } };
      }
    }

    try {
      await this.ssapClient.request(LG_SSAP_URIS.LAUNCH_APP, { id: appId, ...params });
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: 'LAUNCH_FAILED', message: err instanceof Error ? err.message : 'Launch failed' } };
    }
  }

  public async openUrl(url: string): Promise<CommandResult> {
    if (this.usingBridge) {
      try {
        await this.callBridge('command', { uri: LG_SSAP_URIS.OPEN_URL, payload: { target: url } });
        return { success: true };
      } catch (err) {
        return { success: false, error: { code: 'OPEN_FAILED', message: err instanceof Error ? err.message : 'Open failed' } };
      }
    }

    try {
      await this.ssapClient.request(LG_SSAP_URIS.OPEN_URL, { target: url });
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: 'OPEN_FAILED', message: err instanceof Error ? err.message : 'Open failed' } };
    }
  }

  public async sendText(text: string, replace: boolean = false): Promise<CommandResult> {
    if (this.usingBridge) {
      try {
        await this.callBridge('command', { uri: LG_SSAP_URIS.INSERT_TEXT, payload: { text, replace } });
        return { success: true };
      } catch (err) {
        return { success: false, error: { code: 'TEXT_FAILED', message: err instanceof Error ? err.message : 'Text failed' } };
      }
    }

    try {
      await this.ssapClient.request(LG_SSAP_URIS.INSERT_TEXT, { text, replace });
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: 'TEXT_FAILED', message: err instanceof Error ? err.message : 'Text failed' } };
    }
  }

  public async deleteCharacters(count: number = 1): Promise<CommandResult> {
    if (this.usingBridge) {
      try {
        await this.callBridge('command', { uri: LG_SSAP_URIS.DELETE_CHARACTERS, payload: { count } });
        return { success: true };
      } catch (err) {
        return { success: false, error: { code: 'DELETE_FAILED', message: err instanceof Error ? err.message : 'Delete failed' } };
      }
    }

    try {
      await this.ssapClient.request(LG_SSAP_URIS.DELETE_CHARACTERS, { count });
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: 'DELETE_FAILED', message: err instanceof Error ? err.message : 'Delete failed' } };
    }
  }

  public async sendEnter(): Promise<CommandResult> {
    if (this.usingBridge) {
      try {
        await this.callBridge('command', { uri: LG_SSAP_URIS.SEND_ENTER_KEY });
        return { success: true };
      } catch (err) {
        return { success: false, error: { code: 'ENTER_FAILED', message: err instanceof Error ? err.message : 'Enter failed' } };
      }
    }

    try {
      await this.ssapClient.request(LG_SSAP_URIS.SEND_ENTER_KEY);
      return { success: true };
    } catch (err) {
      return { success: false, error: { code: 'ENTER_FAILED', message: err instanceof Error ? err.message : 'Enter failed' } };
    }
  }

  public async mediaPlay(): Promise<CommandResult> {
    return this.usingBridge
      ? this.callBridge('command', { uri: LG_SSAP_URIS.MEDIA_PLAY }).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'PLAY_FAILED', message: e.message } }))
      : this.ssapClient.request(LG_SSAP_URIS.MEDIA_PLAY).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'PLAY_FAILED', message: e.message } }));
  }

  public async mediaPause(): Promise<CommandResult> {
    return this.usingBridge
      ? this.callBridge('command', { uri: LG_SSAP_URIS.MEDIA_PAUSE }).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'PAUSE_FAILED', message: e.message } }))
      : this.ssapClient.request(LG_SSAP_URIS.MEDIA_PAUSE).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'PAUSE_FAILED', message: e.message } }));
  }

  public async mediaStop(): Promise<CommandResult> {
    return this.usingBridge
      ? this.callBridge('command', { uri: LG_SSAP_URIS.MEDIA_STOP }).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'STOP_FAILED', message: e.message } }))
      : this.ssapClient.request(LG_SSAP_URIS.MEDIA_STOP).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'STOP_FAILED', message: e.message } }));
  }

  public async mediaRewind(): Promise<CommandResult> {
    return this.usingBridge
      ? this.callBridge('command', { uri: LG_SSAP_URIS.MEDIA_REWIND }).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'REWIND_FAILED', message: e.message } }))
      : this.ssapClient.request(LG_SSAP_URIS.MEDIA_REWIND).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'REWIND_FAILED', message: e.message } }));
  }

  public async mediaFastForward(): Promise<CommandResult> {
    return this.usingBridge
      ? this.callBridge('command', { uri: LG_SSAP_URIS.MEDIA_FAST_FORWARD }).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'FF_FAILED', message: e.message } }))
      : this.ssapClient.request(LG_SSAP_URIS.MEDIA_FAST_FORWARD).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'FF_FAILED', message: e.message } }));
  }

  public async powerOff(): Promise<CommandResult> {
    return this.usingBridge
      ? this.callBridge('command', { uri: LG_SSAP_URIS.TURN_OFF }).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'POWER_FAILED', message: e.message } }))
      : this.ssapClient.request(LG_SSAP_URIS.TURN_OFF).then(() => ({ success: true })).catch((e) => ({ success: false, error: { code: 'POWER_FAILED', message: e.message } }));
  }

  public getCapabilities(): TVCapabilities {
    return {
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
  }
}
