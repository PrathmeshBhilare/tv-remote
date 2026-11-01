/**
 * Transport abstraction for TV communication.
 * Allows switching between Browser direct WebSocket, Native Android transport,
 * and Local Bridge transport without changing TV adapter or UI logic.
 */

export type TransportType = 'browser-websocket' | 'native-android' | 'local-bridge';

export type TransportErrorCode =
  | 'CERT_AUTHORITY_INVALID'
  | 'LOCAL_NETWORK_PERMISSION_DENIED'
  | 'MIXED_CONTENT_BLOCKED'
  | 'CONNECTION_TIMEOUT'
  | 'CONNECTION_REFUSED'
  | 'TV_UNREACHABLE'
  | 'PAIRING_REJECTED'
  | 'PAIRING_TIMEOUT'
  | 'INCORRECT_PIN'
  | 'UNSUPPORTED_BROWSER_TRANSPORT'
  | 'NATIVE_BRIDGE_NOT_FOUND'
  | 'NOT_CONNECTED'
  | 'SEND_FAILED'
  | 'INSTANTIATION_FAILED'
  | 'HANDSHAKE_FAILED'
  | 'UNKNOWN';

export interface TransportRemedy {
  id: string;
  title: string;
  description: string;
  actionType: 'authorize_cert' | 'native_app' | 'local_bridge' | 'retry' | 'open_url';
  url?: string;
  badge?: string;
}

export interface TransportErrorInfo {
  code: TransportErrorCode;
  title: string;
  message: string;
  technicalDetails?: string;
  remedies: TransportRemedy[];
}

export interface TransportOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  protocols?: string | string[];
}

export interface CloseEventDetails {
  code: number;
  reason: string;
  wasClean: boolean;
}

export interface ITransportConnection {
  readonly transportType: TransportType;
  connect(url: string, options?: TransportOptions): Promise<void>;
  send(message: string): Promise<void>;
  disconnect(code?: number, reason?: string): Promise<void>;
  isConnected(): boolean;

  onMessage(handler: (data: string) => void): () => void;
  onClose(handler: (event: CloseEventDetails) => void): () => void;
  onError(handler: (error: Error) => void): () => void;
}

export class TransportError extends Error {
  public readonly info: TransportErrorInfo;

  constructor(
    message: string,
    public readonly code: TransportErrorCode = 'UNKNOWN',
    public readonly cause?: unknown,
    public readonly isNetworkSecurityRestriction: boolean = false,
    customInfo?: Partial<TransportErrorInfo>
  ) {
    super(message);
    this.name = 'TransportError';

    this.info = {
      code,
      title: customInfo?.title || TransportError.getDefaultTitle(code),
      message,
      technicalDetails: customInfo?.technicalDetails,
      remedies: customInfo?.remedies || TransportError.getDefaultRemedies(code),
    };
  }

  private static getDefaultTitle(code: TransportErrorCode): string {
    switch (code) {
      case 'CERT_AUTHORITY_INVALID':
        return 'Untrusted SSL Certificate (Port 3001)';
      case 'LOCAL_NETWORK_PERMISSION_DENIED':
        return 'Browser Local Network Blocked';
      case 'MIXED_CONTENT_BLOCKED':
        return 'Mixed Content Blocked (HTTPS to WS)';
      case 'CONNECTION_TIMEOUT':
        return 'Connection Timed Out';
      case 'CONNECTION_REFUSED':
        return 'Connection Refused by TV';
      case 'TV_UNREACHABLE':
        return 'TV Unreachable on Wi-Fi';
      case 'PAIRING_REJECTED':
        return 'Pairing Rejected by TV';
      case 'PAIRING_TIMEOUT':
        return 'Pairing Request Expired';
      case 'INCORRECT_PIN':
        return 'Incorrect PIN Code';
      case 'UNSUPPORTED_BROWSER_TRANSPORT':
        return 'Unsupported Browser Environment';
      case 'NATIVE_BRIDGE_NOT_FOUND':
        return 'Native Android Bridge Inactive';
      default:
        return 'Connection Failed';
    }
  }

  private static getDefaultRemedies(code: TransportErrorCode): TransportRemedy[] {
    switch (code) {
      case 'CERT_AUTHORITY_INVALID':
      case 'LOCAL_NETWORK_PERMISSION_DENIED':
        return [
          {
            id: 'native_app',
            title: 'Use Android App (Recommended)',
            description: 'The native Android APK bypasses browser self-signed SSL restrictions completely.',
            actionType: 'native_app',
            badge: 'Recommended',
          },
          {
            id: 'authorize_cert',
            title: 'Authorize TV Certificate Once',
            description: 'Open TV secure port in your browser and accept the self-signed certificate exception.',
            actionType: 'authorize_cert',
          },
          {
            id: 'local_bridge',
            title: 'Run Local Bridge',
            description: 'Run "npm run bridge" on any computer on the same Wi-Fi network.',
            actionType: 'local_bridge',
          },
        ];
      case 'MIXED_CONTENT_BLOCKED':
        return [
          {
            id: 'native_app',
            title: 'Use Android App / PWA',
            description: 'Native containers and localhost run outside strict mixed-content enforcement.',
            actionType: 'native_app',
            badge: 'Recommended',
          },
        ];
      case 'CONNECTION_TIMEOUT':
      case 'TV_UNREACHABLE':
        return [
          {
            id: 'check_tv_power',
            title: 'Verify TV is Powered On',
            description: 'Check that the TV is turned on and connected to the exact same Wi-Fi network (not guest Wi-Fi).',
            actionType: 'retry',
          },
          {
            id: 'check_tv_settings',
            title: 'Enable Mobile TV On',
            description: 'In TV Settings > General > Mobile TV On / LG Connect Apps, ensure permissions are enabled.',
            actionType: 'retry',
          },
        ];
      case 'PAIRING_REJECTED':
        return [
          {
            id: 'retry_pairing',
            title: 'Retry Pairing',
            description: 'Press "Allow" or "Yes" on your TV screen using your physical remote when prompted.',
            actionType: 'retry',
          },
        ];
      case 'INCORRECT_PIN':
        return [
          {
            id: 'check_pin',
            title: 'Verify 8-Digit Code',
            description: 'Check your TV screen for the current pairing code and enter it accurately.',
            actionType: 'retry',
          },
        ];
      default:
        return [
          {
            id: 'retry',
            title: 'Try Again',
            description: 'Check TV connection and retry.',
            actionType: 'retry',
          },
        ];
    }
  }
}
