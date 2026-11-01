import {
  ITransportConnection,
  TransportType,
  TransportOptions,
  CloseEventDetails,
  TransportError,
  TransportErrorCode,
} from './transport';

function isPrivateLanUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return (
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.16.') ||
      host.startsWith('172.17.') ||
      host.startsWith('172.18.') ||
      host.startsWith('172.19.') ||
      host.startsWith('172.2') ||
      host.startsWith('172.30.') ||
      host.startsWith('172.31.') ||
      host.endsWith('.local') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

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
            'Browser WebSocket transport is only available in browser environments.',
            'UNSUPPORTED_BROWSER_TRANSPORT'
          )
        );
      }

      const isHttpsPage = window.location.protocol === 'https:';
      const isPlainWs = url.startsWith('ws://');
      const isSecureWs = url.startsWith('wss://');
      const isLanTarget = isPrivateLanUrl(url);

      // 1. Detect W3C Mixed Content Violation upfront
      if (isHttpsPage && isPlainWs) {
        return reject(
          new TransportError(
            `Mixed Content Blocked: Browser cannot connect from an HTTPS origin (${window.location.origin}) to an unencrypted WebSocket URL (${url}). Modern browsers require secure transport or native Android container.`,
            'MIXED_CONTENT_BLOCKED',
            undefined,
            true,
            {
              title: 'Mixed Content Blocked',
              technicalDetails:
                'W3C Security Policy forbids insecure ws:// connections from secure https:// web origins. To connect to port 3000, run locally or use the native Android app.',
            }
          )
        );
      }

      // Clean up previous socket if any
      if (this.ws) {
        try {
          this.ws.close();
        } catch {
          // ignore
        }
        this.ws = null;
      }

      const timeoutMs = options?.timeoutMs ?? 7000;
      const startTime = Date.now();
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
                `Connection timeout after ${timeoutMs}ms while connecting to ${url}. The TV did not respond. Check if the TV is powered on, Wi-Fi is connected, and the IP is correct.`,
                'CONNECTION_TIMEOUT',
                undefined,
                false,
                {
                  title: 'TV Connection Timeout',
                  technicalDetails: `TCP SYN sent to ${url} but received no response within ${timeoutMs}ms. Verify TV IP address and that TV is not in deep sleep mode.`,
                }
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
          const elapsed = Date.now() - startTime;

          // Accurately classify the error
          let code: TransportErrorCode = 'UNKNOWN';
          let message: string;
          let technical: string;
          let isSecurityRestriction = false;

          if (isHttpsPage && isSecureWs && isLanTarget && elapsed < 3000) {
            // Rapid failure on HTTPS to private IP wss://3001 is the hallmark of
            // browser self-signed TLS cert rejection or Private Network Access preflight block
            code = 'CERT_AUTHORITY_INVALID';
            isSecurityRestriction = true;
            message = `Cannot connect to TV at ${url}. Web browsers on HTTPS require authorizing the TV's self-signed TLS certificate once, or using the native Android companion.`;
            technical = `TLS handshake rejected by browser: ERR_CERT_AUTHORITY_INVALID. LG webOS TVs use an internal self-signed certificate on port 3001 which public HTTPS origins cannot validate automatically.`;
          } else if (elapsed >= timeoutMs - 500) {
            code = 'CONNECTION_TIMEOUT';
            message = `Connection to ${url} timed out. Verify TV power and Wi-Fi connection.`;
            technical = `Timed out after ${elapsed}ms waiting for WebSocket handshake to complete.`;
          } else {
            code = 'CONNECTION_REFUSED';
            message = `WebSocket connection refused by TV at ${url}. Ensure the TV is powered on and LG Connect Apps is enabled in TV settings.`;
            technical = `Handshake aborted after ${elapsed}ms. Port 3001 may be blocked by TV or router AP isolation.`;
          }

          const error = new TransportError(message, code, event, isSecurityRestriction, {
            title: TransportError['getDefaultTitle'](code),
            technicalDetails: technical,
          });

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

            const elapsed = Date.now() - startTime;
            let code: TransportErrorCode = 'HANDSHAKE_FAILED';
            let message = `WebSocket closed during handshake (code: ${event.code}, reason: "${event.reason || 'None'}").`;

            if (event.code === 1006 && isHttpsPage && isSecureWs && isLanTarget && elapsed < 3000) {
              code = 'CERT_AUTHORITY_INVALID';
              message = `Cannot connect to TV at ${url}. On deployed HTTPS apps, browsers block self-signed certificates on local devices. Tap "Authorize TV in Browser" or use the Native Android app.`;
            }

            reject(
              new TransportError(
                message,
                code,
                event,
                code === 'CERT_AUTHORITY_INVALID',
                {
                  technicalDetails: `WebSocket CloseEvent code=${event.code}, wasClean=${event.wasClean}, elapsed=${elapsed}ms`,
                }
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
