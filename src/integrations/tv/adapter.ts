import {
  TVProfile,
  ConnectionResult,
  TVStatus,
  CommandResult,
  RemoteKey,
  TVApp,
  TVCapabilities,
  ConnectionState,
} from './types';

export interface ITVAdapter {
  readonly brand: string;
  connect(profile: TVProfile, preferredPairingType?: 'PROMPT' | 'PIN'): Promise<ConnectionResult>;
  sendPin(pin: string): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  getStatus(): Promise<TVStatus>;
  setVolumeUp(): Promise<CommandResult>;
  setVolumeDown(): Promise<CommandResult>;
  setMute(muted: boolean): Promise<CommandResult>;
  pressKey(key: RemoteKey): Promise<CommandResult>;
  launchApp(appId: string, params?: Record<string, unknown>): Promise<CommandResult>;
  openUrl?(url: string): Promise<CommandResult>;
  getInstalledApps(): Promise<CommandResult<TVApp[]>>;
  sendText(text: string, replace?: boolean): Promise<CommandResult>;
  sendEnter(): Promise<CommandResult>;
  deleteCharacters?(count?: number): Promise<CommandResult>;
  mediaPlay(): Promise<CommandResult>;
  mediaPause(): Promise<CommandResult>;
  mediaStop(): Promise<CommandResult>;
  mediaRewind(): Promise<CommandResult>;
  mediaFastForward(): Promise<CommandResult>;
  powerOff(): Promise<CommandResult>;
  getCapabilities(): TVCapabilities;
  onStateChange(listener: (state: ConnectionState, message?: string) => void): () => void;
}

