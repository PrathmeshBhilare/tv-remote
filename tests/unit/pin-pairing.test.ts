import test from 'node:test';
import assert from 'node:assert/strict';
import { SSAPClient, SSAPMessage } from '../../src/integrations/lg-webos/ssap-client';
import { LGWebOSTVAdapter } from '../../src/integrations/lg-webos/lg-adapter';
import { ITransportConnection, CloseEventDetails, TransportOptions, TransportType } from '../../src/transport/transport';

class MockTransport implements ITransportConnection {
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

test('SSAPClient - PIN Pairing Handshake and Verification Flow', async () => {
  const mockTransport = new MockTransport();
  const client = new SSAPClient({
    transportFactory: () => mockTransport,
    handshakeTimeoutMs: 5000,
  });

  // Step 1: Initiate connection with preferred pairingType = 'PIN'
  const connectPromise = client.connect('ws://192.168.1.50:3000', undefined, 'PIN');
  await new Promise((r) => setTimeout(r, 10));

  // Verify registration payload specifies "pairingType": "PIN"
  assert.equal(mockTransport.sentMessages.length, 1);
  const regMsg: SSAPMessage = JSON.parse(mockTransport.sentMessages[0]);
  assert.equal(regMsg.type, 'register');
  assert.equal((regMsg.payload as { pairingType?: string }).pairingType, 'PIN');

  // Step 2: TV responds that it is displaying a PIN on-screen
  mockTransport.simulateMessage(
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
  assert.equal(connectResult.requiresPin, true);
  assert.equal(client.getState(), 'pairing_pin');

  // Step 3: User submits the PIN displayed on the TV screen
  const pinPromise = client.sendPin('84920192');
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(mockTransport.sentMessages.length, 2);
  const setPinMsg: SSAPMessage = JSON.parse(mockTransport.sentMessages[1]);
  assert.equal(setPinMsg.type, 'request');
  assert.equal(setPinMsg.uri, 'ssap://pairing/setPin');
  assert.equal((setPinMsg.payload as { pin?: string }).pin, '84920192');

  // Step 4: TV validates PIN and sends registered event with client-key
  mockTransport.simulateMessage(
    JSON.stringify({
      id: setPinMsg.id,
      type: 'registered',
      payload: {
        'client-key': 'secret-client-key-from-pin-flow-999',
      },
    })
  );

  const pinResult = await pinPromise;
  assert.equal(pinResult.clientKey, 'secret-client-key-from-pin-flow-999');
  assert.equal(client.getClientKey(), 'secret-client-key-from-pin-flow-999');
  assert.equal(client.getState(), 'connected');

  await client.disconnect();
});

test('SSAPClient - Incorrect PIN Error Handling', async () => {
  const mockTransport = new MockTransport();
  const client = new SSAPClient({
    transportFactory: () => mockTransport,
    handshakeTimeoutMs: 5000,
  });

  const connectPromise = client.connect('ws://192.168.1.50:3000', undefined, 'PIN');
  await new Promise((r) => setTimeout(r, 10));

  mockTransport.simulateMessage(
    JSON.stringify({
      id: 'register_0',
      type: 'response',
      payload: { pairingType: 'PIN', returnValue: true },
    })
  );
  await connectPromise;

  // Submit incorrect PIN
  const pinPromise = client.sendPin('00000000');
  await new Promise((r) => setTimeout(r, 10));

  const setPinMsg: SSAPMessage = JSON.parse(mockTransport.sentMessages[1]);

  // TV reports error
  mockTransport.simulateMessage(
    JSON.stringify({
      id: setPinMsg.id,
      type: 'error',
      error: '401 Unauthorized: Invalid PIN',
      payload: { returnValue: false },
    })
  );

  await assert.rejects(
    async () => {
      await pinPromise;
    },
    (err: Error) => {
      assert.ok(err.message.includes('Incorrect PIN'));
      return true;
    }
  );

  await client.disconnect();
});

test('LGWebOSTVAdapter - Full PIN pairing workflow integration', async () => {
  let mockTransport: any = null;
  const adapter = new LGWebOSTVAdapter(() => {
    mockTransport = new MockTransport();
    return mockTransport;
  });

  const connectPromise = adapter.connect(
    {
      id: 'tv-pin-1',
      name: 'LG OLED TV',
      ip: '192.168.1.80',
      port: 3000,
      useSecureWs: false,
      pairingType: 'PIN',
    },
    'PIN'
  );

  await new Promise((r) => setTimeout(r, 10));
  assert.ok(mockTransport);

  // TV indicates PIN mode
  mockTransport.simulateMessage(
    JSON.stringify({
      id: 'register_0',
      type: 'response',
      payload: { pairingType: 'PIN', returnValue: true },
    })
  );

  const connRes = await connectPromise;
  assert.equal(connRes.requiresPin, true);

  // Submit PIN via adapter
  const sendPinPromise = adapter.sendPin('12345678');
  await new Promise((r) => setTimeout(r, 10));

  mockTransport.simulateMessage(
    JSON.stringify({
      id: 'register_0',
      type: 'registered',
      payload: { 'client-key': 'valid-pin-key-777' },
    })
  );

  const pinRes = await sendPinPromise;
  assert.ok(pinRes.success);
  assert.equal(pinRes.clientKey, 'valid-pin-key-777');

  await adapter.disconnect();
});

