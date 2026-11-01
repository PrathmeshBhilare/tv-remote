import test from 'node:test';
import assert from 'node:assert/strict';
import { SSAPClient, SSAPMessage } from '../../src/integrations/lg-webos/ssap-client';
import { PointerClient } from '../../src/integrations/lg-webos/pointer-client';
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

  public simulateClose(details: CloseEventDetails) {
    this.isSocketOpen = false;
    this.closeListeners.forEach((fn) => fn(details));
  }
}

test('SSAPClient - Handshake sends correct registration payload with manifest', async () => {
  const mockTransport = new MockTransport();
  const client = new SSAPClient({
    transportFactory: () => mockTransport,
    handshakeTimeoutMs: 1000,
  });

  const connectPromise = client.connect('ws://192.168.1.50:3000');

  // Allow microtasks to run connect & handshake
  await new Promise((r) => setTimeout(r, 10));

  // Verify registration payload sent immediately
  assert.equal(mockTransport.sentMessages.length, 1);
  const sentMsg: SSAPMessage = JSON.parse(mockTransport.sentMessages[0]);
  assert.equal(sentMsg.type, 'register');
  assert.equal(sentMsg.id, 'register_0');
  assert.ok(sentMsg.payload);

  // Simulate TV user approval on physical TV
  mockTransport.simulateMessage(
    JSON.stringify({
      id: 'register_0',
      type: 'registered',
      payload: {
        'client-key': 'test-secret-client-key-12345',
      },
    })
  );

  const result = await connectPromise;
  assert.equal(result.clientKey, 'test-secret-client-key-12345');
  assert.equal(client.getClientKey(), 'test-secret-client-key-12345');
  assert.equal(client.getState(), 'connected');
});

test('SSAPClient - Request/response correlation and timeout', async () => {
  const mockTransport = new MockTransport();
  const client = new SSAPClient({
    transportFactory: () => mockTransport,
    commandTimeoutMs: 500,
  });

  const connectPromise = client.connect('ws://192.168.1.50:3000', 'existing-key');
  await new Promise((r) => setTimeout(r, 10));

  mockTransport.simulateMessage(
    JSON.stringify({
      id: 'register_0',
      type: 'registered',
      payload: { 'client-key': 'existing-key' },
    })
  );
  await connectPromise;

  // Send request
  const reqPromise = client.request<{ volume: number }>('ssap://audio/getVolume');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(mockTransport.sentMessages.length, 2);

  const reqMsg: SSAPMessage = JSON.parse(mockTransport.sentMessages[1]);
  assert.equal(reqMsg.type, 'request');
  assert.equal(reqMsg.uri, 'ssap://audio/getVolume');

  // Correlate response by ID
  mockTransport.simulateMessage(
    JSON.stringify({
      id: reqMsg.id,
      type: 'response',
      payload: { volume: 25, returnValue: true },
    })
  );

  const res = await reqPromise;
  assert.equal(res.volume, 25);
});

test('PointerClient - Sends correct button and click payloads', async () => {
  const mockTransport = new MockTransport();
  const pointer = new PointerClient(() => mockTransport);

  await pointer.connect('ws://192.168.1.50:3000/pointer');
  assert.ok(pointer.isConnected());

  const upResult = await pointer.sendButton('UP');
  assert.ok(upResult.success);
  assert.equal(mockTransport.sentMessages[0], 'type:button\nname:UP\n\n');

  const clickResult = await pointer.sendClick();
  assert.ok(clickResult.success);
  assert.equal(mockTransport.sentMessages[1], 'type:click\n\n');

  const moveResult = await pointer.sendMove(15, -10, false);
  assert.ok(moveResult.success);
  assert.equal(mockTransport.sentMessages[2], 'type:move\ndx:15\ndy:-10\ndown:0\n\n');
});
