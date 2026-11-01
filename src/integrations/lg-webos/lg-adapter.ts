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
import { SSAPClient, SSAPMessage } from './ssap-client';
import { PointerClient } from './pointer-client';
import { LG_SSAP_URIS } from './commands';
import { ITransportConnection } from '../../transport/transport';

async function safeParseJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned HTTP ${res.status}`);
  }
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
    this.ssapClient = new SSAPClient({
      transportFactory,
      onStateChange: (state, message) => {
        this.notifyStateChange(state, message);
      },
    });
    this.pointerClient = new PointerClient(transportFactory);
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

    // In real web browser (localhost/LAN) without custom mock transport, use local server bridge
    // This bypasses browser self-signed SSL restrictions on port 3001
    if (typeof window !== 'undefined' && !this.hasCustomTransport) {
      try {
        this.usingBridge = true;
        this.notifyStateChange('connecting', `Connecting to ${profile.name || profile.ip}...`);

        const bridgeRes = await fetch('/api/tv/bridge', {
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
          throw new Error(data.error.message || 'TV connection failed');
        }
      } catch (bridgeErr) {
        this.notifyStateChange('error', bridgeErr instanceof Error ? bridgeErr.message : 'Connection failed');
        return {
          success: false,
          error: {
            code: 'BRIDGE_CONNECTION_FAILED',
            message: bridgeErr instanceof Error ? bridgeErr.message : 'Connection failed',
          },
        };
      }
    }

    // Direct transport (used for unit tests and native Android wrappers)
    this.usingBridge = false;
    const protocol = profile.useSecureWs ? 'wss' : 'ws';
    const url = `${protocol}://${profile.ip}:${port}`;

    try {
      const reg = await this.ssapClient.connect(url, profile.clientKey, pairingMode);

      if (reg.requiresPin) {
        return { success: false, requiresPin: true, pairingType: 'PIN' };
      }

      return { success: true, clientKey: reg.clientKey };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: err instanceof Error ? err.message : 'Connection failed',
        },
      };
    }
  }

  public async sendPin(pin: string): Promise<ConnectionResult> {
    if (!this.currentProfile) {
      return { success: false, error: { code: 'NO_PROFILE', message: 'No TV selected' } };
    }

    if (this.usingBridge) {
      try {
        this.notifyStateChange('connecting', 'Verifying PIN with TV...');
        const res = await fetch('/api/tv/bridge', {
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
      const res = await this.ssapClient.sendPin(pin);
      return { success: true, clientKey: res.clientKey };
    } catch (err) {
      return {
        success: false,
        error: { code: 'PIN_VERIFICATION_FAILED', message: err instanceof Error ? err.message : 'PIN failed' },
      };
    }
  }

  private async callBridge(action: string, extra: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.currentProfile) throw new Error('No active TV profile');
    const res = await fetch('/api/tv/bridge', {
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
      try {
        await fetch('/api/tv/bridge', {
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
