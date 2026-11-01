import {
  ITransportConnection,
  TransportType,
  TransportOptions,
  CloseEventDetails,
  TransportError,
} from './transport';

interface AndroidBridgeApi {
  connect: (socketIdOrUrl: string, urlMaybe?: string) => void;
  send: (socketIdOrMsg: string, messageMaybe?: string) => boolean;
  disconnect: (socketId?: string) => void;
  isConnected: (socketId?: string) => boolean;
}

/**
 * Native Android companion & Capacitor transport.
 *
 * When the app runs inside the native Android APK shell:
 * - Uses the native OkHttp WebSocket bridge (window.AndroidBridge)
 * - Directly reaches LG webOS TVs at wss://192.168.1.x:3001
 * - Accepts the TV's self-signed TLS certificate seamlessly
 * - Supports multiple concurrent sockets (SSAP control + Pointer navigation)
 * - Bypasses all browser sandbox, CORS, and Private Network Access limitations
 * - Requires NO laptop, NO local bridge server, and NO external computer
 */
export class NativeAndroidTransport implements ITransportConnection {
  public readonly transportType: TransportType = 'native-android';
  public readonly instanceId = 'sock_' + Math.random().toString(36).substring(2, 9);
  private ws: WebSocket | null = null;
  private messageListeners = new Set<(data: string) => void>();
  private closeListeners = new Set<(event: CloseEventDetails) => void>();
  private errorListeners = new Set<(error: Error) => void>();
  private connected = false;

  private static activeInstances = new Map<string, NativeAndroidTransport>();
  private connectResolver: (() => void) | null = null;
  private connectRejecter: ((err: Error) => void) | null = null;
  private connectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    NativeAndroidTransport.ensureBridgeListeners();
  }

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

  private static ensureBridgeListeners() {
    if (typeof window === 'undefined') return;
    const win = window as unknown as {
      __androidBridgeListenersInstalled?: boolean;
      __onAndroidBridgeOpen?: (id?: string) => void;
      __onAndroidBridgeMessage?: (arg1: string, arg2?: string) => void;
      __onAndroidBridgeClose?: (arg1: unknown, arg2?: unknown, arg3?: unknown) => void;
      __onAndroidBridgeError?: (arg1: string, arg2?: string) => void;
    };

    if (win.__androidBridgeListenersInstalled) return;
    win.__androidBridgeListenersInstalled = true;

    win.__onAndroidBridgeOpen = (socketId?: string) => {
      if (socketId && NativeAndroidTransport.activeInstances.has(socketId)) {
        NativeAndroidTransport.activeInstances.get(socketId)?.handleBridgeOpen();
      } else {
        NativeAndroidTransport.activeInstances.forEach((inst) => inst.handleBridgeOpen());
      }
    };

    win.__onAndroidBridgeMessage = (arg1: string, arg2?: string) => {
      if (typeof arg2 !== 'undefined') {
        const inst = NativeAndroidTransport.activeInstances.get(arg1);
        inst?.handleBridgeMessage(arg2);
      } else {
        NativeAndroidTransport.activeInstances.forEach((inst) => inst.handleBridgeMessage(arg1));
      }
    };

    win.__onAndroidBridgeClose = (arg1: unknown, arg2?: unknown, arg3?: unknown) => {
      if (typeof arg3 !== 'undefined') {
        const inst = NativeAndroidTransport.activeInstances.get(String(arg1));
        inst?.handleBridgeClose(Number(arg2) || 1000, String(arg3 || 'Closed'));
      } else {
        NativeAndroidTransport.activeInstances.forEach((inst) =>
          inst.handleBridgeClose(Number(arg1) || 1000, String(arg2 || 'Closed'))
        );
      }
    };

    win.__onAndroidBridgeError = (arg1: string, arg2?: string) => {
      if (typeof arg2 !== 'undefined') {
        const inst = NativeAndroidTransport.activeInstances.get(arg1);
        inst?.handleBridgeError(arg2);
      } else {
        NativeAndroidTransport.activeInstances.forEach((inst) => inst.handleBridgeError(arg1));
      }
    };
  }

  private handleBridgeOpen() {
    if (this.connectTimeoutId) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
    this.connected = true;
    if (this.connectResolver) {
      const resolve = this.connectResolver;
      this.connectResolver = null;
      this.connectRejecter = null;
      resolve();
    }
  }

  private handleBridgeMessage(raw: string) {
    this.messageListeners.forEach((fn) => {
      try {
        fn(raw);
      } catch (err) {
        console.error('[NativeTransport] Message listener error:', err);
      }
    });
  }

  private handleBridgeClose(code: number, reason: string) {
    this.connected = false;
    NativeAndroidTransport.activeInstances.delete(this.instanceId);

    if (this.connectTimeoutId) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }

    if (this.connectRejecter) {
      const reject = this.connectRejecter;
      this.connectResolver = null;
      this.connectRejecter = null;
      reject(
        new TransportError(
          `Native WebSocket closed during handshake (code: ${code}, reason: ${reason})`,
          'HANDSHAKE_FAILED'
        )
      );
    }

    const details: CloseEventDetails = {
      code,
      reason,
      wasClean: true,
    };
    this.closeListeners.forEach((fn) => fn(details));
  }

  private handleBridgeError(errorMsg: string) {
    const error = new TransportError(`Native TV socket error: ${errorMsg}`, 'CONNECTION_REFUSED');

    if (this.connectTimeoutId) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }

    if (this.connectRejecter) {
      const reject = this.connectRejecter;
      this.connectResolver = null;
      this.connectRejecter = null;
      reject(error);
    } else {
      this.errorListeners.forEach((fn) => fn(error));
    }
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
        this.connectResolver = resolve;
        this.connectRejecter = reject;

        NativeAndroidTransport.activeInstances.set(this.instanceId, this);

        this.connectTimeoutId = setTimeout(() => {
          this.connectTimeoutId = null;
          if (this.connectRejecter) {
            const rej = this.connectRejecter;
            this.connectResolver = null;
            this.connectRejecter = null;
            NativeAndroidTransport.activeInstances.delete(this.instanceId);
            try {
              bridge.disconnect(this.instanceId);
            } catch {}
            rej(
              new TransportError(
                `Native connection to TV at ${url} timed out after ${timeoutMs}ms.`,
                'CONNECTION_TIMEOUT'
              )
            );
          }
        }, timeoutMs);

        try {
          bridge.connect(this.instanceId, url);
        } catch (err) {
          if (this.connectTimeoutId) {
            clearTimeout(this.connectTimeoutId);
            this.connectTimeoutId = null;
          }
          NativeAndroidTransport.activeInstances.delete(this.instanceId);
          this.connectResolver = null;
          this.connectRejecter = null;
          reject(
            new TransportError(
              `Failed to invoke AndroidBridge.connect: ${err instanceof Error ? err.message : String(err)}`,
              'INSTANTIATION_FAILED',
              err
            )
          );
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
      const ok = bridge.send(this.instanceId, message);
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
        bridge.disconnect(this.instanceId);
      } catch {}
      NativeAndroidTransport.activeInstances.delete(this.instanceId);
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
      return bridge.isConnected(this.instanceId);
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
