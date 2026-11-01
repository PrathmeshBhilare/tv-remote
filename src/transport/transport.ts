/**
 * Transport abstraction for TV communication.
 * Allows switching between Browser direct WebSocket and Native Android transport
 * without changing the TV adapter or UI logic.
 */

export type TransportType = 'browser-websocket' | 'native-android' | 'local-bridge';

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
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
    public readonly isNetworkSecurityRestriction: boolean = false
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

