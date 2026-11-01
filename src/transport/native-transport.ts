import { ITransportConnection, TransportType, TransportOptions, CloseEventDetails, TransportError } from './transport';

/**
 * Native Android companion/Capacitor transport stub.
 * This adapter implements ITransportConnection by delegating to a native Android bridge
 * (e.g. Capacitor plugin or Android WebView interface) that bypasses Chrome's PNA,
 * mixed-content, and TLS validation restrictions for local LAN IP addresses.
 *
 * It is activated when running inside the Android shell or when browser networking fails.
 */
export class NativeAndroidTransport implements ITransportConnection {
  public readonly transportType: TransportType = 'native-android';
  private messageListeners = new Set<(data: string) => void>();
  private closeListeners = new Set<(event: CloseEventDetails) => void>();
  private errorListeners = new Set<(error: Error) => void>();
  private connected = false;

  public static isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    // Check for Android native bridge injection or Capacitor plugin
    const win = window as unknown as {
      AndroidBridge?: unknown;
      Capacitor?: { isPluginAvailable?: (name: string) => boolean };
    };
    return (
      typeof win.AndroidBridge !== 'undefined' ||
      Boolean(win.Capacitor?.isPluginAvailable?.('NativeWebSocket'))
    );
  }

  public async connect(url: string, _options?: TransportOptions): Promise<void> {
    if (!NativeAndroidTransport.isAvailable()) {
      throw new TransportError(
        'Native Android Transport is not available in the current environment. To use native transport, run inside the Android Capacitor container.',
        'NATIVE_BRIDGE_NOT_FOUND'
      );
    }
    // Stub implementation ready for native plugin integration
    this.connected = true;
  }

  public async send(message: string): Promise<void> {
    if (!this.connected) {
      throw new TransportError('Native socket is not connected.', 'NOT_CONNECTED');
    }
    // Stub: delegate to native bridge
    console.debug('[NativeTransport] Sending message:', message);
  }

  public async disconnect(_code?: number, _reason?: string): Promise<void> {
    this.connected = false;
    this.closeListeners.forEach((fn) =>
      fn({ code: 1000, reason: 'Disconnected by client', wasClean: true })
    );
  }

  public isConnected(): boolean {
    return this.connected;
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
