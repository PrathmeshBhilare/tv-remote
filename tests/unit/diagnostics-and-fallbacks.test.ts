import test from 'node:test';
import assert from 'node:assert/strict';
import { TransportError, TransportErrorInfo } from '../../src/transport/transport';
import { NativeAndroidTransport } from '../../src/transport/native-transport';
import { TVProfileStorage } from '../../src/storage/tv-store';
import { LGWebOSTVAdapter } from '../../src/integrations/lg-webos/lg-adapter';
import { ITransportConnection, CloseEventDetails, TransportOptions, TransportType } from '../../src/transport/transport';

test('Transport Diagnostics - Generates actionable error info and remedies', () => {
  const err = new TransportError(
    'Cannot connect to TV at wss://192.168.1.10:3001',
    'CERT_AUTHORITY_INVALID',
    undefined,
    true,
    {
      technicalDetails: 'ERR_CERT_AUTHORITY_INVALID',
    }
  );

  assert.equal(err.code, 'CERT_AUTHORITY_INVALID');
  assert.equal(err.isNetworkSecurityRestriction, true);
  assert.ok(err.info.title.includes('SSL Certificate'));
  assert.equal(err.info.technicalDetails, 'ERR_CERT_AUTHORITY_INVALID');
  assert.ok(err.info.remedies.length >= 2);

  const nativeRemedy = err.info.remedies.find((r) => r.actionType === 'native_app');
  assert.ok(nativeRemedy);
  assert.ok(nativeRemedy.description.includes('Android'));

  const certRemedy = err.info.remedies.find((r) => r.actionType === 'authorize_cert');
  assert.ok(certRemedy);
});

test('NativeAndroidTransport - Reports unavailable in standard browser and available when bridge present', () => {
  // In Node test environment, window is undefined
  assert.equal(NativeAndroidTransport.isAvailable(), false);

  // Mock native environment
  (global as any).window = {
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    },
  };

  assert.equal(NativeAndroidTransport.isAvailable(), true);

  // Clean up
  delete (global as any).window;
});

test('TVProfileStorage - Manages profiles and bridge configuration', () => {
  // Mock localStorage for storage tests
  const store: Record<string, string> = {};
  (global as any).window = {
    localStorage: {
      getItem: (k: string) => store[k] || null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
  };

  TVProfileStorage.saveProfile({
    id: 'tv-test-1',
    name: 'Living Room LG TV',
    ip: '192.168.1.10',
    port: 3001,
    useSecureWs: true,
    clientKey: 'key-12345',
  });

  const active = TVProfileStorage.getActiveProfile();
  assert.ok(active);
  assert.equal(active.ip, '192.168.1.10');
  assert.equal(active.clientKey, 'key-12345');

  // Test Bridge URL
  TVProfileStorage.setBridgeUrl('http://192.168.1.5:3005');
  assert.equal(TVProfileStorage.getBridgeUrl(), 'http://192.168.1.5:3005');

  // Clean up
  delete (global as any).window;
});

test('LGWebOSTVAdapter - Propagates TransportError code and remedies to ConnectionResult', async () => {
  class FailingTransport implements ITransportConnection {
    public readonly transportType: TransportType = 'browser-websocket';
    public async connect(): Promise<void> {
      throw new TransportError(
        'TLS handshake failed for wss://192.168.1.10:3001',
        'CERT_AUTHORITY_INVALID',
        undefined,
        true,
        {
          technicalDetails: 'ERR_CERT_AUTHORITY_INVALID',
        }
      );
    }
    public async send(): Promise<void> {}
    public async disconnect(): Promise<void> {}
    public isConnected(): boolean {
      return false;
    }
    public onMessage(): () => void {
      return () => {};
    }
    public onClose(): () => void {
      return () => {};
    }
    public onError(): () => void {
      return () => {};
    }
  }

  const adapter = new LGWebOSTVAdapter(() => new FailingTransport());

  const result = await adapter.connect({
    id: 'tv-fail',
    name: 'LG TV',
    ip: '192.168.1.10',
    port: 3001,
    useSecureWs: true,
  });

  assert.equal(result.success, false);
  assert.ok(result.error);
  assert.equal(result.error.code, 'CERT_AUTHORITY_INVALID');
  const details = result.error.details as TransportErrorInfo;
  assert.ok(details);
  assert.equal(details.technicalDetails, 'ERR_CERT_AUTHORITY_INVALID');
  assert.ok(details.remedies.length > 0);
});
