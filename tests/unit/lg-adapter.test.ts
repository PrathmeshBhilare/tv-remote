import test from 'node:test';
import assert from 'node:assert/strict';
import { LGWebOSTVAdapter } from '../../src/integrations/lg-webos/lg-adapter';
import { ITransportConnection, CloseEventDetails, TransportOptions, TransportType } from '../../src/transport/transport';
import { BrowserWebSocketTransport } from '../../src/transport/browser-websocket';
import { SSAPMessage } from '../../src/integrations/lg-webos/ssap-client';

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

test('LGWebOSTVAdapter - Connect, Pair, Volume commands, and App Discovery', async () => {
  let mockTransport: any = null;
  const adapter = new LGWebOSTVAdapter(() => {
    mockTransport = new MockTransport();
    return mockTransport;
  });

  const connectPromise = adapter.connect({
    id: 'tv-1',
    name: 'Living Room TV',
    ip: '192.168.1.100',
    port: 3000,
    useSecureWs: false,
  });

  await new Promise((r) => setTimeout(r, 10));
  assert.ok(mockTransport);

  // TV confirms pairing
  mockTransport.simulateMessage(
    JSON.stringify({
      id: 'register_0',
      type: 'registered',
      payload: { 'client-key': 'valid-tv-key-abc' },
    })
  );

  const connectResult = await connectPromise;
  assert.ok(connectResult.success);
  assert.equal(connectResult.clientKey, 'valid-tv-key-abc');

  // Test Volume Up
  const volUpPromise = adapter.setVolumeUp();
  await new Promise((r) => setTimeout(r, 10));
  const volUpMsg: SSAPMessage = JSON.parse(mockTransport.sentMessages[mockTransport.sentMessages.length - 1]);
  assert.equal(volUpMsg.uri, 'ssap://audio/volumeUp');
  mockTransport.simulateMessage(
    JSON.stringify({
      id: volUpMsg.id,
      type: 'response',
      payload: { returnValue: true },
    })
  );
  const volResult = await volUpPromise;
  assert.ok(volResult.success);

  // Test App Discovery
  const appsPromise = adapter.getInstalledApps();
  await new Promise((r) => setTimeout(r, 10));
  const listAppsMsg: SSAPMessage = JSON.parse(mockTransport.sentMessages[mockTransport.sentMessages.length - 1]);
  mockTransport.simulateMessage(
    JSON.stringify({
      id: listAppsMsg.id,
      type: 'response',
      payload: {
        launchPoints: [
          { id: 'youtube.leanback.v4', title: 'YouTube' },
          { id: 'netflix', title: 'Netflix' },
        ],
        returnValue: true,
      },
    })
  );
  const appsResult = await appsPromise;
  assert.ok(appsResult.success);
  assert.equal(appsResult.data?.length, 2);
  assert.equal(appsResult.data?.[0].title, 'YouTube');
  assert.equal(appsResult.data?.[1].title, 'Netflix');

  await adapter.disconnect();
});

test('BrowserWebSocketTransport - Rejects mixed content when in HTTPS page', async () => {
  // Simulate window.location on HTTPS
  const originalWindow = globalThis.window;
  (globalThis as unknown as { window: unknown }).window = {
    location: { protocol: 'https:' },
  };

  const transport = new BrowserWebSocketTransport();
  await assert.rejects(
    async () => {
      await transport.connect('ws://192.168.1.50:3000');
    },
    (err: Error & { code?: string; isNetworkSecurityRestriction?: boolean }) => {
      assert.equal(err.code, 'MIXED_CONTENT_BLOCKED');
      assert.equal(err.isNetworkSecurityRestriction, true);
      return true;
    }
  );

  (globalThis as unknown as { window: unknown }).window = originalWindow;
});
