import {
  ITransportConnection,
  TransportType,
  TransportOptions,
  CloseEventDetails,
  TransportError,
} from './transport';

interface AndroidBridgeApi {
  connect: (url: string) => void;
  send: (message: string) => boolean;
  disconnect: () => void;
  isConnected: () => boolean;
}

/**
 * Native Android companion & Capacitor transport.
 *
 * When the app runs inside the native Android APK shell:
 * - Uses the native OkHttp WebSocket bridge (window.AndroidBridge)
 * - Directly reaches LG webOS TVs at wss://192.168.1.x:3001
 * - Accepts the TV's self-signed TLS certificate seamlessly
 * - Bypasses all browser sandbox, CORS, and Private Network Access limitations
 * - Requires NO laptop, NO local bridge server, and NO external computer
 */
export class NativeAndroidTransport implements ITransportConnection {
  public readonly transportType: TransportType = 'native-android';
  private ws: WebSocket | null = null;
  private messageListeners = new Set<(data: string) => void>();
  private closeListeners = new Set<(event: CloseEventDetails) => void>();
  private errorListeners = new Set<(error: Error) => void>();
  private connected = false;

  private static getBridge(): AndroidBridgeApi | null {
    if (typeof window === 'undefined') return null;
    const win = window as unknown as { AndroidBridge?: AndroidBridgeApi };
    if (win.AndroidBridge && typeof win.AndroidBridge.connect === 'function') {
      return win.AndroidBridge;
    }
    return null;
  }

  public static isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const bridge = NativeAndroidTransport.getBridge();
    if (bridge) return true;

    const win = window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        getPlatform?: () => string;
      };
    };

    if (win.Capacitor?.isNativePlatform?.()) return true;
    if (win.Capacitor?.getPlatform?.() === 'android') return true;
    return false;
  }

  public async connect(url: string, options?: TransportOptions): Promise<void> {
    if (!NativeAndroidTransport.isAvailable()) {
      throw new TransportError(
        'Native Android Transport is only available inside the Android app container. Download the APK or run with Capacitor to enable native networking.',
        'NATIVE_BRIDGE_NOT_FOUND',
        undefined,
        false,
        {
          title: 'Native Android Shell Required',
          technicalDetails:
            'Capacitor.isNativePlatform() returned false and AndroidBridge was not detected. Open the app inside the native Android APK build.',
        }
      );
    }

    const bridge = NativeAndroidTransport.getBridge();

    // 1. If native AndroidBridge is present (OkHttp WebSocket direct to TV)
    if (bridge) {
      return new Promise<void>((resolve, reject) => {
        const timeoutMs = options?.timeoutMs ?? 10000;
        let settled = false;
        const win = window as unknown as {
          __onAndroidBridgeOpen?: () => void;
          __onAndroidBridgeMessage?: (data: string) => void;
          __onAndroidBridgeClose?: (code: number, reason: string) => void;
          __onAndroidBridgeError?: (error: string) => void;
        };

        const timeoutId = setTimeout(() => {
          if (!settled) {
            settled = true;
            try {
              bridge.disconnect();
            } catch {}
            reject(
              new TransportError(
                `Native connection to TV at ${url} timed out after ${timeoutMs}ms.`,
                'CONNECTION_TIMEOUT'
              )
            );
          }
        }, timeoutMs);

        win.__onAndroidBridgeOpen = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            this.connected = true;
            resolve();
          }
        };

        win.__onAndroidBridgeMessage = (raw: string) => {
          this.messageListeners.forEach((fn) => {
            try {
              fn(raw);
            } catch (err) {
              console.error('[NativeTransport] Message handler error:', err);
            }
          });
        };

        win.__onAndroidBridgeClose = (code: number, reason: string) => {
          this.connected = false;
          const details: CloseEventDetails = {
            code: code || 1000,
            reason: reason || 'Normal Closure',
            wasClean: true,
          };

          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            reject(
              new TransportError(
                `Native WebSocket closed during handshake (code: ${code}, reason: ${reason})`,
                'HANDSHAKE_FAILED'
              )
            );
          }

          this.closeListeners.forEach((fn) => fn(details));
        };

        win.__onAndroidBridgeError = (errorMsg: string) => {
          const error = new TransportError(
            `Native Android TV socket error: ${errorMsg}`,
            'CONNECTION_REFUSED'
          );

          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            reject(error);
          } else {
            this.errorListeners.forEach((fn) => fn(error));
          }
        };

        try {
          bridge.connect(url);
        } catch (err) {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            reject(
              new TransportError(
                `Failed to invoke AndroidBridge.connect: ${err instanceof Error ? err.message : String(err)}`,
                'INSTANTIATION_FAILED',
                err
              )
            );
          }
        }
      });
    }

    // 2. Fallback to WebView WebSocket (for generic Capacitor localhost origins)
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
    const bridge = NativeAndroidTransport.getBridge();
    if (bridge) {
      const ok = bridge.send(message);
      if (!ok && !this.connected) {
        throw new TransportError('Native AndroidBridge socket is not open.', 'NOT_CONNECTED');
      }
      return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new TransportError('Native socket is not open.', 'NOT_CONNECTED');
    }
    this.ws.send(message);
  }

  public async disconnect(code: number = 1000, reason: string = 'Normal Closure'): Promise<void> {
    const bridge = NativeAndroidTransport.getBridge();
    if (bridge) {
      try {
        bridge.disconnect();
      } catch {}
    }

    if (this.ws) {
      try {
        this.ws.close(code, reason);
      } catch {}
      this.ws = null;
    }
    this.connected = false;
  }

  public isConnected(): boolean {
    const bridge = NativeAndroidTransport.getBridge();
    if (bridge) {
      return bridge.isConnected();
    }
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
