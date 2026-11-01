export type RemoteKey =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'ENTER'
  | 'BACK'
  | 'HOME'
  | 'RED'
  | 'GREEN'
  | 'YELLOW'
  | 'BLUE'
  | 'PLAY'
  | 'PAUSE'
  | 'STOP'
  | 'REWIND'
  | 'FAST_FORWARD'
  | 'VOLUME_UP'
  | 'VOLUME_DOWN'
  | 'MUTE';

export interface TVCapabilities {
  volume: boolean;
  mute: boolean;
  navigation: boolean;
  textInput: boolean;
  appLaunch: boolean;
  mediaPlayback: boolean;
  youtubeSearch: boolean;
  powerOn: boolean;
  powerOff: boolean;
}

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'pairing_prompt'
  | 'pairing_pin'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface TVApp {
  id: string;
  title: string;
  iconUrl?: string;
  largeIconUrl?: string;
  systemApp?: boolean;
}

export interface CommandResult<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ConnectionResult {
  success: boolean;
  clientKey?: string;
  requiresPin?: boolean;
  pairingType?: 'PROMPT' | 'PIN' | 'COMBINED';
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface TVProfile {
  id: string;
  name: string;
  ip: string;
  port: number;
  useSecureWs: boolean;
  pairingType?: 'PROMPT' | 'PIN';
  clientKey?: string;
  macAddress?: string;
  modelName?: string;
  webosVersion?: string;
  lastConnected?: string;
}

export interface PostPairingTestResult {
  volumeTested: boolean;
  volumeSuccess: boolean;
  navigationTested: boolean;
  navigationSuccess: boolean;
  timestamp: string;
  message: string;
}

export interface TVStatus {
  connected: boolean;
  connectionState: ConnectionState;
  currentAppId?: string;
  volumeLevel?: number;
  isMuted?: boolean;
  modelName?: string;
}

