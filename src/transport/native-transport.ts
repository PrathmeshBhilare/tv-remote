import {
  ITransportConnection,
  TransportType,
  TransportOptions,
  CloseEventDetails,
  TransportError,
} from './transport';

/**
 * Native Android companion & Capacitor transport.
 *
 * When the app is bundled or wrapped in a native Android shell (Capacitor or Android WebView),
 * native networking bypasses the browser's untrusted CA blocks and Private Network Access
 * restrictions that affect public HTTPS web origins (like Vercel).
 *
 * It uses native OkHttp / WebSocket bridge when available, or Capacitor's localhost-origin
 * WebSocket runtime which has access to local network IP addresses without PNA restrictions.
 */
export class NativeAndroidTransport implements ITransportConnection {
  public readonly transportType: TransportType = 'native-android';
  private ws: WebSocket | null = null;
  private messageListeners = new Set<(data: string) => void>();
  private closeListeners = new Set<(event: CloseEventDetails) => void>();
  private errorListeners = new Set<(error: Error) => void>();
  private connected = false;

  public static isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        getPlatform?: () => string;
        isPluginAvailable?: (name: string) => boolean;
      };
      AndroidBridge?: unknown;
    };

    if (typeof win.AndroidBridge !== 'undefined') return true;
    if (win.Capacitor?.isNativePlatform?.()) return true;
    if (win.Capacitor?.getPlatform?.() === 'android') return true;
    return false;
  }

  public async connect(url: string, options?: TransportOptions): Promise<void> {
    if (!NativeAndroidTransport.isAvailable()) {
      // In web browser mode, inform the user why native transport is recommended
      throw new TransportError(
        'Native Android Transport is only available inside the Android app container. Download the APK or run with Capacitor to enable native networking.',
        'NATIVE_BRIDGE_NOT_FOUND',
        undefined,
        false,
        {
          title: 'Native Android Shell Required',
          technicalDetails:
            'Capacitor.isNativePlatform() returned false. To use native networking, open the app inside the native Android APK build.',
        }
      );
    }

    // Inside Capacitor / Android Native:
    // WebSockets run from localhost origin or native OkHttp client, bypassing PNA and self-signed cert blocks.
    return new Promise((resolve, reject) => {
      const timeoutMs = options?.timeoutMs ?? 10000;
      let settled = false;

      try {
        const socket = options?.protocols ? new WebSocket(url, options.protocols) : new WebSocket(url);
        this.ws = socket;

        const timeoutId = setTimeout(() => {
          if (!settled) {
            settled = true;
            try {
              socket.close();
            } catch {}
            reject(
              new TransportError(
                `Native connection to TV at ${url} timed out after ${timeoutMs}ms.`,
                'CONNECTION_TIMEOUT'
              )
            );
          }
        }, timeoutMs);

        socket.onopen = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            this.connected = true;
            resolve();
          }
        };

        socket.onmessage = (event: MessageEvent) => {
          const rawData = typeof event.data === 'string' ? event.data : String(event.data);
          this.messageListeners.forEach((fn) => {
            try {
              fn(rawData);
            } catch (err) {
              console.error('[NativeTransport] Error in message listener:', err);
            }
          });
        };

        socket.onerror = (event: Event) => {
          const error = new TransportError(
            `Native WebSocket error communicating with TV at ${url}`,
            'CONNECTION_REFUSED',
            event
          );

          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            reject(error);
          } else {
            this.errorListeners.forEach((fn) => fn(error));
          }
        };

        socket.onclose = (event: CloseEvent) => {
          this.connected = false;
          const details: CloseEventDetails = {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          };

          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            reject(
              new TransportError(
                `Native WebSocket closed during handshake (code: ${event.code})`,
                'HANDSHAKE_FAILED',
                event
              )
            );
          }

          this.closeListeners.forEach((fn) => fn(details));
          this.ws = null;
        };
      } catch (err) {
        reject(
          new TransportError(
            `Failed to initialize native WebSocket: ${err instanceof Error ? err.message : String(err)}`,
            'INSTANTIATION_FAILED',
            err
          )
        );
      }
    });
  }

  public async send(message: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new TransportError('Native socket is not open.', 'NOT_CONNECTED');
    }
    this.ws.send(message);
  }

  public async disconnect(code: number = 1000, reason: string = 'Normal Closure'): Promise<void> {
    if (this.ws) {
      try {
        this.ws.close(code, reason);
      } catch {}
      this.ws = null;
    }
    this.connected = false;
  }

  public isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public onMessage(handler: (data: string) => void): () => void {
    this.messageListeners.add(handler);
    return () => this.messageListeners.delete(handler);
  }

  public onClose(handler: (event: CloseEventDetails) => void): () => void {
    this.closeListeners.add(handler);
    return () => this.closeListeners.delete(handler);
  }

  public onError(handler: (error: Error) => void): () => void {
    this.errorListeners.add(handler);
    return () => this.errorListeners.delete(handler);
  }
}
