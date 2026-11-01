import { ITransportConnection, TransportType, TransportOptions, CloseEventDetails, TransportError } from './transport';

export class BrowserWebSocketTransport implements ITransportConnection {
  public readonly transportType: TransportType = 'browser-websocket';
  private ws: WebSocket | null = null;
  private messageListeners = new Set<(data: string) => void>();
  private closeListeners = new Set<(event: CloseEventDetails) => void>();
  private errorListeners = new Set<(error: Error) => void>();

  public connect(url: string, options?: TransportOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
        return reject(
          new TransportError(
            'Browser WebSocket is only available in browser environments.',
            'ENV_UNAVAILABLE'
          )
        );
      }

      // Check for HTTPS mixed-content violation
      const isHttpsPage = window.location.protocol === 'https:';
      const isPlainWsTarget = url.startsWith('ws://');
      if (isHttpsPage && isPlainWsTarget) {
        return reject(
          new TransportError(
            'Mixed Content Blocked: Browser cannot connect from an HTTPS origin to an insecure ws:// URL. Use wss:// or load the app over HTTP/localhost/PWA.',
            'MIXED_CONTENT_BLOCKED',
            undefined,
            true
          )
        );
      }

      // Clean up any existing connection
      if (this.ws) {
        try {
          this.ws.close();
        } catch {
          // Ignore close errors during re-init
        }
        this.ws = null;
      }

      const timeoutMs = options?.timeoutMs ?? 7000;
      let connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
      let hasSettled = false;

      try {
        const socket = options?.protocols ? new WebSocket(url, options.protocols) : new WebSocket(url);
        this.ws = socket;

        connectionTimeoutId = setTimeout(() => {
          if (!hasSettled) {
            hasSettled = true;
            try {
              socket.close();
            } catch {
              // ignore
            }
            reject(
              new TransportError(
                `Connection timeout after ${timeoutMs}ms while connecting to ${url}. Check TV IP address and network accessibility.`,
                'CONNECTION_TIMEOUT'
              )
            );
          }
        }, timeoutMs);

        socket.onopen = () => {
          if (!hasSettled) {
            hasSettled = true;
            if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
            resolve();
          }
        };

        socket.onmessage = (event: MessageEvent) => {
          const rawData = typeof event.data === 'string' ? event.data : String(event.data);
          this.messageListeners.forEach((fn) => {
            try {
              fn(rawData);
            } catch (err) {
              console.error('Error in message listener:', err);
            }
          });
        };

        socket.onerror = (event: Event) => {
          const isSecurityBlock = isHttpsPage && (isPlainWsTarget || url.startsWith('wss://'));
          const errorMsg = isHttpsPage
            ? `Cannot connect to TV at ${url}. On HTTPS / deployed apps, browsers require authorizing the TV's self-signed certificate once. Click "Authorize TV in Browser" below.`
            : `WebSocket encountered an error connecting to ${url}. Check if the TV is powered on, on the same Wi-Fi, and the port is accessible.`;
          const error = new TransportError(
            errorMsg,
            isHttpsPage ? 'CERT_OR_LAN_BLOCKED' : 'SOCKET_ERROR',
            event,
            isSecurityBlock
          );

          if (!hasSettled) {
            hasSettled = true;
            if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
            reject(error);
          } else {
            this.errorListeners.forEach((fn) => {
              try {
                fn(error);
              } catch (err) {
                console.error('Error in error listener:', err);
              }
            });
          }
        };

        socket.onclose = (event: CloseEvent) => {
          const details: CloseEventDetails = {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          };

          if (!hasSettled) {
            hasSettled = true;
            if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
            reject(
              new TransportError(
                `Connection closed during handshake (code: ${event.code}, reason: "${event.reason || 'None'}").`,
                'HANDSHAKE_FAILED',
                event
              )
            );
          }

          this.closeListeners.forEach((fn) => {
            try {
              fn(details);
            } catch (err) {
              console.error('Error in close listener:', err);
            }
          });
          this.ws = null;
        };
      } catch (err) {
        if (connectionTimeoutId) clearTimeout(connectionTimeoutId);
        reject(
          new TransportError(
            `Failed to instantiate WebSocket for ${url}: ${err instanceof Error ? err.message : String(err)}`,
            'INSTANTIATION_FAILED',
            err
          )
        );
      }
    });
  }

  public send(message: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(
          new TransportError(
            'Cannot send message: WebSocket is not open.',
            'NOT_CONNECTED'
          )
        );
      }
      try {
        this.ws.send(message);
        resolve();
      } catch (err) {
        reject(
          new TransportError(
            `Failed to send message: ${err instanceof Error ? err.message : String(err)}`,
            'SEND_FAILED',
            err
          )
        );
      }
    });
  }

  public disconnect(code: number = 1000, reason: string = 'Normal Closure'): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }
      try {
        this.ws.close(code, reason);
      } catch {
        // ignore
      }
      this.ws = null;
      resolve();
    });
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
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

