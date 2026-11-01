import test from 'node:test';
import assert from 'node:assert/strict';
import { LGWebOSTVAdapter } from '../../src/integrations/lg-webos/lg-adapter';
import { ITransportConnection, CloseEventDetails, TransportOptions, TransportType } from '../../src/transport/transport';
import { SSAPMessage } from '../../src/integrations/lg-webos/ssap-client';

class MockDirectTransport implements ITransportConnection {
  public readonly transportType: TransportType = 'browser-websocket';
  public sentMessages: string[] = [];
  public isSocketOpen = false;
  private messageListeners = new Set<(data: string) => void>();
  private closeListeners = new Set<(event: CloseEventDetails) => void>();
  private errorListeners = new Set<(error: Error) => void>();

  public async connect(_url: string, _options?: TransportOptions): Promise<void> {
    this.isSocketOpen = true;
  }

  public async send(message: string): Promise<void> {
    this.sentMessages.push(message);
  }

  public async disconnect(): Promise<void> {
    this.isSocketOpen = false;
  }

  public isConnected(): boolean {
    return this.isSocketOpen;
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

  public simulateMessage(data: string) {
    this.messageListeners.forEach((fn) => fn(data));
  }
}

test('Direct Client Connection - PIN code requested and verified on TV', async () => {
  let mockTransport: any = null;
  const adapter = new LGWebOSTVAdapter(() => {
    mockTransport = new MockDirectTransport();
    return mockTransport;
  });

  // Step 1: Client initiates connection requesting PIN
  const connectPromise = adapter.connect(
    {
      id: 'tv-direct-1',
      name: 'LG webOS Smart TV',
      ip: '192.168.1.10',
      port: 3001,
      useSecureWs: true,
      pairingType: 'PIN',
    },
    'PIN'
  );

  await new Promise((r) => setTimeout(r, 10));
  assert.ok(mockTransport);

  // TV receives registration and requests PIN
  mockTransport!.simulateMessage(
    JSON.stringify({
      id: 'register_0',
      type: 'response',
      payload: {
        pairingType: 'PIN',
        returnValue: true,
      },
    })
  );

  const connectResult = await connectPromise;
  assert.equal(connectResult.success, false);
  assert.equal(connectResult.requiresPin, true);
  assert.equal(connectResult.pairingType, 'PIN');

  // Step 2: User enters the 8-digit PIN displayed on their TV screen
  const pinPromise = adapter.sendPin('12345678');
  await new Promise((r) => setTimeout(r, 10));

  // TV confirms PIN and registers client key
  mockTransport!.simulateMessage(
    JSON.stringify({
      id: 'register_0',
      type: 'registered',
      payload: {
        'client-key': 'paired-secret-client-key-xyz',
        returnValue: true,
      },
    })
  );

  const pinResult = await pinPromise;
  assert.equal(pinResult.success, true);
  assert.equal(pinResult.clientKey, 'paired-secret-client-key-xyz');
});

