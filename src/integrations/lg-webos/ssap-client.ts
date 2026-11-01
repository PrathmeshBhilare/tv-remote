import { ITransportConnection } from '../../transport/transport';
import { BrowserWebSocketTransport } from '../../transport/browser-websocket';
import { LG_PERMISSIONS_MANIFEST, LG_SSAP_URIS } from './commands';
import { ConnectionState } from '../tv/types';

export interface SSAPMessage<T = unknown> {
  id: string;
  type: 'register' | 'registered' | 'request' | 'response' | 'subscribe' | 'unsubscribe' | 'error';
  uri?: string;
  payload?: T;
  error?: string;
}

export interface RegisterPayload {
  'client-key'?: string;
  returnValue?: boolean;
  pairingType?: string;
  errorText?: string;
}

export interface SSAPClientOptions {
  handshakeTimeoutMs?: number;
  commandTimeoutMs?: number;
  onStateChange?: (state: ConnectionState, message?: string) => void;
  transportFactory?: () => ITransportConnection;
}

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export class SSAPClient {
  private transport: ITransportConnection | null = null;
  private reqCounter = 0;
  private pendingRequests = new Map<string, PendingRequest>();
  private connectionState: ConnectionState = 'disconnected';
  private unregisterTransportListeners: (() => void)[] = [];
  private currentClientKey: string | null = null;
  private activePairingResolver: ((val: { clientKey?: string; requiresPin?: boolean }) => void) | null = null;
  private activePairingRejecter: ((err: Error) => void) | null = null;

  constructor(private options: SSAPClientOptions = {}) {}

  public getState(): ConnectionState {
    return this.connectionState;
  }

  public getClientKey(): string | null {
    return this.currentClientKey;
  }

  private setState(state: ConnectionState, message?: string) {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.options.onStateChange?.(state, message);
    }
  }

  public async connect(
    url: string,
    existingClientKey?: string,
    preferredPairingType: 'PROMPT' | 'PIN' = 'PROMPT'
  ): Promise<{ clientKey?: string; requiresPin?: boolean }> {
    this.setState('connecting', `Connecting to TV at ${url}...`);

    // Clean up previous transport if any
    await this.disconnect();

    const factory = this.options.transportFactory ?? (() => new BrowserWebSocketTransport());
    this.transport = factory();

    const unMessage = this.transport.onMessage((data) => this.handleIncomingMessage(data));
    const unClose = this.transport.onClose((details) => {
      this.setState('disconnected', `Connection closed (code: ${details.code})`);
      this.cleanupPendingRequests(new Error(`WebSocket closed: ${details.reason || 'Closed'}`));
    });
    const unError = this.transport.onError((err) => {
      this.setState('error', err.message);
    });
    this.unregisterTransportListeners = [unMessage, unClose, unError];

    try {
      await this.transport.connect(url, {
        timeoutMs: this.options.handshakeTimeoutMs ?? 8000,
      });
    } catch (err) {
      this.setState('error', err instanceof Error ? err.message : 'Failed to connect to TV');
      throw err;
    }

    // Begin pairing / registration handshake
    return this.performRegistration(existingClientKey, preferredPairingType);
  }

  private performRegistration(
    existingClientKey?: string,
    preferredPairingType: 'PROMPT' | 'PIN' = 'PROMPT'
  ): Promise<{ clientKey?: string; requiresPin?: boolean }> {
    return new Promise((resolve, reject) => {
      const regId = 'register_0';
      const timeoutMs = this.options.handshakeTimeoutMs ?? 60000; // 60s for user action

      this.activePairingResolver = resolve;
      this.activePairingRejecter = reject;

      if (!existingClientKey) {
        if (preferredPairingType === 'PIN') {
          this.setState('connecting', 'Requesting PIN from TV...');
        } else {
          this.setState(
            'pairing_prompt',
            'Please accept the connection prompt on your TV screen with your physical remote.'
          );
        }
      } else {
        this.setState('connecting', 'Authenticating with saved client key...');
      }

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(regId);
        this.activePairingResolver = null;
        this.activePairingRejecter = null;
        this.setState('error', 'Pairing timed out. Authorization was not completed in time.');
        reject(new Error('Pairing timed out waiting for TV user approval.'));
      }, timeoutMs);

      this.pendingRequests.set(regId, {
        resolve: (payload: unknown) => {
          clearTimeout(timeoutId);
          this.activePairingResolver = null;
          this.activePairingRejecter = null;
          const regPayload = payload as RegisterPayload;
          const returnedKey = regPayload['client-key'] || existingClientKey;
          if (!returnedKey) {
            this.setState('error', 'Registration succeeded but no client-key was received.');
            reject(new Error('TV did not provide a client-key.'));
            return;
          }
          this.currentClientKey = returnedKey;
          this.setState('connected', 'Successfully connected and paired with TV.');
          resolve({ clientKey: returnedKey });
        },
        reject: (err: Error) => {
          clearTimeout(timeoutId);
          this.activePairingResolver = null;
          this.activePairingRejecter = null;
          this.setState('error', `Pairing failed: ${err.message}`);
          reject(err);
        },
        timeoutId,
      });

      const registerMessage: SSAPMessage = {
        id: regId,
        type: 'register',
        payload: {
          forcePairing: false,
          pairingType: preferredPairingType,
          manifest: LG_PERMISSIONS_MANIFEST,
          ...(existingClientKey ? { 'client-key': existingClientKey } : {}),
        },
      };

      if (!this.transport) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(regId);
        return reject(new Error('Transport is not initialized.'));
      }

      this.transport.send(JSON.stringify(registerMessage)).catch((err) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(regId);
        this.activePairingResolver = null;
        this.activePairingRejecter = null;
        reject(err);
      });
    });
  }

  /**
   * Submit on-screen PIN code to finalize webOS pairing.
   */
  public sendPin(pin: string): Promise<{ clientKey: string }> {
    return new Promise((resolve, reject) => {
      if (!this.transport || !this.transport.isConnected()) {
        return reject(new Error('Cannot send PIN: TV WebSocket is not connected.'));
      }

      const cleanPin = pin.trim();
      if (!cleanPin) {
        return reject(new Error('PIN cannot be empty.'));
      }

      const reqId = `register_pin_${++this.reqCounter}`;
      const timeoutMs = 20000;

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        this.setState('error', 'PIN submission timed out. Check if the code on the TV has expired.');
        reject(new Error('PIN verification timed out.'));
      }, timeoutMs);

      this.pendingRequests.set(reqId, {
        resolve: (payload: unknown) => {
          clearTimeout(timeoutId);
          const p = payload as RegisterPayload;
          const returnedKey = p?.['client-key'] || this.currentClientKey;
          if (returnedKey) {
            this.currentClientKey = returnedKey;
            this.setState('connected', 'PIN accepted! Successfully paired with TV.');
            resolve({ clientKey: returnedKey });
          } else {
            // Some firmware sends registered with a different id or subsequent event
            this.setState('connecting', 'PIN sent, waiting for registration confirmation...');
          }
        },
        reject: (err: Error) => {
          clearTimeout(timeoutId);
          const lower = err.message.toLowerCase();
          const isPinError =
            lower.includes('pin') ||
            lower.includes('unauthorized') ||
            lower.includes('401') ||
            lower.includes('fail') ||
            lower.includes('denied') ||
            lower.includes('error');
          const msg = isPinError
            ? 'Incorrect PIN entered. Please verify the code displayed on your TV screen.'
            : err.message;
          this.setState('error', msg);
          reject(new Error(msg));
        },
        timeoutId,
      });

      // Also listen on register_0 in case the TV emits the final key under register_0
      const reg0Pending = this.pendingRequests.get('register_0');
      if (reg0Pending) {
        const origResolve = reg0Pending.resolve;
        reg0Pending.resolve = (payload: unknown) => {
          clearTimeout(timeoutId);
          const p = payload as RegisterPayload;
          const key = p?.['client-key'];
          if (key) {
            this.currentClientKey = key;
            this.setState('connected', 'PIN accepted! Successfully paired with TV.');
            resolve({ clientKey: key });
          }
          origResolve(payload);
        };
      }

      const setPinMessage: SSAPMessage = {
        id: reqId,
        type: 'request',
        uri: LG_SSAP_URIS.SET_PIN,
        payload: {
          pin: cleanPin,
        },
      };

      this.transport.send(JSON.stringify(setPinMessage)).catch((err) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(reqId);
        reject(err);
      });
    });
  }

  public request<T = unknown>(
    uri: string,
    payload?: Record<string, unknown>,
    timeoutMsOverride?: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.transport || !this.transport.isConnected()) {
        return reject(new Error('Cannot send request: SSAP client is not connected to TV.'));
      }

      const id = `req_${++this.reqCounter}`;
      const timeoutMs = timeoutMsOverride ?? this.options.commandTimeoutMs ?? 6000;

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${uri} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (data) => resolve(data as T),
        reject,
        timeoutId,
      });

      const message: SSAPMessage = {
        id,
        type: 'request',
        uri,
        payload,
      };

      this.transport.send(JSON.stringify(message)).catch((err) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        reject(err);
      });
    });
  }

  private handleIncomingMessage(rawMessage: string) {
    let msg: SSAPMessage;
    try {
      msg = JSON.parse(rawMessage);
    } catch {
      console.warn('[SSAP] Received unparseable message from TV');
      return;
    }

    const { id, type, payload, error } = msg;

    // Handle pairing prompt or PIN notification from TV
    if (type === 'response' && id === 'register_0' && payload) {
      const p = payload as { pairingType?: string; returnValue?: boolean };
      if (p.pairingType === 'PIN' || p.pairingType === 'LGSWITCH-PIN') {
        this.setState('pairing_pin', 'Please enter the PIN code displayed on your TV screen.');
        if (this.activePairingResolver) {
          this.activePairingResolver({ requiresPin: true });
          this.activePairingResolver = null;
          this.activePairingRejecter = null;
        }
        return;
      } else if (p.pairingType === 'PROMPT' || p.pairingType === 'COMBINED') {
        this.setState(
          'pairing_prompt',
          'Please accept the connection prompt on your TV screen with your physical remote.'
        );
      }
    }

    // Direct registration event with client key
    if (type === 'registered') {
      const p = payload as RegisterPayload;
      if (p && p['client-key']) {
        this.currentClientKey = p['client-key'];
        this.setState('connected', 'Successfully paired with TV.');
      }
    }

    if (!id || !this.pendingRequests.has(id)) {
      // If we got a 'registered' message that matches register_0 while pending register_pin
      if (type === 'registered' && this.pendingRequests.has('register_0')) {
        const pending0 = this.pendingRequests.get('register_0')!;
        this.pendingRequests.delete('register_0');
        clearTimeout(pending0.timeoutId);
        pending0.resolve(payload);
      }
      return;
    }

    const pending = this.pendingRequests.get(id)!;
    this.pendingRequests.delete(id);
    clearTimeout(pending.timeoutId);

    if (type === 'error' || error) {
      const errorMessage = error || (payload as { errorText?: string })?.errorText || 'Unknown SSAP error';
      pending.reject(new Error(errorMessage));
      return;
    }

    if (payload && (payload as { returnValue?: boolean }).returnValue === false) {
      const errText = (payload as { errorText?: string }).errorText || 'TV command returned failure';
      pending.reject(new Error(errText));
      return;
    }

    pending.resolve(payload);
  }

  private cleanupPendingRequests(error: Error) {
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    });
    this.pendingRequests.clear();
    if (this.activePairingRejecter) {
      this.activePairingRejecter(error);
      this.activePairingResolver = null;
      this.activePairingRejecter = null;
    }
  }

  public async disconnect(): Promise<void> {
    this.cleanupPendingRequests(new Error('SSAP Client disconnected'));
    this.unregisterTransportListeners.forEach((fn) => fn());
    this.unregisterTransportListeners = [];

    if (this.transport) {
      try {
        await this.transport.disconnect();
      } catch {
        // ignore
      }
      this.transport = null;
    }
    this.setState('disconnected');
  }

  public isConnected(): boolean {
    return this.connectionState === 'connected' && (this.transport?.isConnected() ?? false);
  }
}
