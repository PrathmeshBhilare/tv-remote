#!/usr/bin/env node

/**
 * LG Control - Secured Local Bridge Service
 *
 * This lightweight local service runs on your local network (e.g. your PC or home server).
 * It bridges commands between deployed HTTPS web clients (like Vercel) and your local LG webOS TV,
 * bypassing browser self-signed TLS certificate checks (ERR_CERT_AUTHORITY_INVALID) and
 * Private Network Access restrictions.
 *
 * Usage:
 *   npm run bridge
 *   # or
 *   node scripts/bridge.js
 */

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.BRIDGE_PORT || '3005', 10);
const HOST = process.env.BRIDGE_HOST || '0.0.0.0';
const KEYS_FILE = path.join(__dirname, '..', '.tv-keys.json');

// LG webOS SSAP URIs
const LG_SSAP_URIS = {
  VOLUME_UP: 'ssap://audio/volumeUp',
  VOLUME_DOWN: 'ssap://audio/volumeDown',
  SET_MUTE: 'ssap://audio/setMute',
  TURN_OFF: 'ssap://system/turnOff',
  LAUNCH_APP: 'ssap://system.launcher/launch',
  LIST_APPS: 'ssap://com.webos.applicationManager/listApps',
  LIST_LAUNCH_POINTS: 'ssap://com.webos.applicationManager/listLaunchPoints',
  OPEN_URL: 'ssap://system.launcher/open',
  INSERT_TEXT: 'ssap://com.webos.service.ime/insertText',
  DELETE_CHARACTERS: 'ssap://com.webos.service.ime/deleteCharacters',
  SEND_ENTER_KEY: 'ssap://com.webos.service.ime/sendEnterKey',
  GET_POINTER_INPUT_SOCKET: 'ssap://com.webos.service.networkinput/getPointerInputSocket',
  SET_PIN: 'ssap://pairing/setPin',
};

const LG_PERMISSIONS_MANIFEST = {
  manifestVersion: 1,
  appVersion: '1.0.0',
  signed: {
    created: '20240101',
    appId: 'com.lgcontrol.remote',
    vendorId: 'com.lgcontrol',
    localizedAppNames: { '': 'LG Control Remote' },
    localizedVendorNames: { '': 'LG Control' },
    permissions: [
      'LAUNCH',
      'LAUNCH_WEBAPP',
      'APP_TO_APP',
      'CLOSE',
      'TEST_OPEN',
      'TEST_PROTECTED',
      'CONTROL_AUDIO',
      'CONTROL_DISPLAY',
      'CONTROL_INPUT_JOYSTICK',
      'CONTROL_INPUT_MEDIA_RECORDING',
      'CONTROL_INPUT_MEDIA_PLAYBACK',
      'CONTROL_INPUT_TV',
      'READ_APP_STATUS',
      'READ_CURRENT_CHANNEL',
      'READ_INPUT_DEVICE_LIST',
      'READ_NETWORK_STATE',
      'READ_RUNNING_APPS',
      'READ_TV_CHANNEL_LIST',
      'WRITE_NOTIFICATION_TOAST',
      'CHECK_BLUETOOTH_DEVICE',
    ],
    serial: '0000000000000001',
  },
  permissions: [
    'LAUNCH',
    'CONTROL_AUDIO',
    'CONTROL_INPUT_JOYSTICK',
    'CONTROL_INPUT_MEDIA_PLAYBACK',
    'READ_RUNNING_APPS',
  ],
};

function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  return (
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.endsWith('.local') ||
    ip === 'localhost' ||
    ip === '127.0.0.1'
  );
}

function getSavedKeys() {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')) || {};
    }
  } catch {}
  return {};
}

function saveKeyForIp(ip, key) {
  try {
    const keys = getSavedKeys();
    keys[ip] = key;
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
  } catch {}
}

function removeKeyForIp(ip) {
  try {
    const keys = getSavedKeys();
    delete keys[ip];
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
  } catch {}
}

const connectionPool = new Map();

function createTvSocket(ip, port = 3001, useSecureWs = true, clientKey, pairingType = 'PIN') {
  const poolKey = `${ip}:${port}`;
  const existing = connectionPool.get(poolKey);

  if (existing && existing.ws.readyState === WebSocket.OPEN && existing.isPaired) {
    existing.lastUsed = Date.now();
    return Promise.resolve({ connection: existing, newClientKey: existing.clientKey });
  }

  if (existing) {
    try {
      existing.ws.close();
      existing.pointerWs?.close();
    } catch {}
    connectionPool.delete(poolKey);
  }

  const effectiveKey = clientKey || getSavedKeys()[ip];

  return new Promise((resolve, reject) => {
    const protocol = useSecureWs ? 'wss' : 'ws';
    const targetUrl = `${protocol}://${ip}:${port}`;

    let ws;
    try {
      ws = new WebSocket(targetUrl, {
        rejectUnauthorized: false, // Safely accept local LG TV self-signed TLS cert
        handshakeTimeout: 8000,
      });
    } catch (err) {
      return reject(err);
    }

    const conn = {
      ws,
      ip,
      port,
      useSecureWs,
      clientKey: effectiveKey,
      isPaired: false,
      lastUsed: Date.now(),
    };

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws.close(); } catch {}
        reject(new Error(`Connection to TV at ${ip}:${port} timed out.`));
      }
    }, 15000);

    ws.on('open', () => {
      const regPayload = {
        forcePairing: false,
        manifest: LG_PERMISSIONS_MANIFEST,
      };

      if (effectiveKey) {
        regPayload['client-key'] = effectiveKey;
      } else {
        regPayload.pairingType = pairingType;
      }

      const regMsg = {
        id: 'register_0',
        type: 'register',
        payload: regPayload,
      };

      try {
        ws.send(JSON.stringify(regMsg));
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        }
      }
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'registered') {
          const key = msg.payload?.['client-key'] || effectiveKey;
          conn.clientKey = key;
          conn.isPaired = true;
          connectionPool.set(poolKey, conn);
          if (key) saveKeyForIp(ip, key);

          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve({ connection: conn, newClientKey: key });
          }
          return;
        }

        if (!effectiveKey && msg.type === 'response' && msg.id === 'register_0') {
          const pt = msg.payload?.pairingType;
          if (pt === 'PIN' || pt === 'LGSWITCH-PIN') {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              connectionPool.set(poolKey, conn);
              return resolve({ connection: conn, requiresPin: true });
            }
          } else if (pt === 'PROMPT') {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              connectionPool.set(poolKey, conn);
              return resolve({ connection: conn, requiresPrompt: true });
            }
          }
        }
      } catch {}
    });

    ws.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`TV WebSocket error: ${err.message}`));
      }
    });

    ws.on('close', () => {
      connectionPool.delete(poolKey);
    });
  });
}

const server = http.createServer(async (req, res) => {
  // Set CORS and Chrome Private Network Access headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-bridge-token');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health probe
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/tv/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'lg-remote-local-bridge',
        version: '1.0.0',
        activeConnections: connectionPool.size,
      })
    );
    return;
  }

  // Bridge relay endpoint
  if (req.method === 'POST' && (req.url === '/api/tv/bridge' || req.url === '/bridge')) {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 1024 * 64) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Payload too large' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const body = JSON.parse(rawBody);
        const { action, ip, port = 3001, useSecureWs = true, clientKey, pairingType, pin, uri, payload, key } = body;

        if (!ip || !isPrivateIp(ip)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: { message: 'Invalid or missing private TV IP address.' } }));
          return;
        }

        const targetPort = Number(port) || 3001;

        if (action === 'forget') {
          removeKeyForIp(ip);
          const poolKey = `${ip}:${targetPort}`;
          const existing = connectionPool.get(poolKey);
          if (existing) {
            try {
              existing.ws.close();
              existing.pointerWs?.close();
            } catch {}
            connectionPool.delete(poolKey);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'TV credentials removed.' }));
          return;
        }

        if (action === 'connect') {
          try {
            const result = await createTvSocket(ip, targetPort, useSecureWs, clientKey, pairingType);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: result.connection.isPaired,
                requiresPin: result.requiresPin,
                requiresPrompt: result.requiresPrompt,
                clientKey: result.newClientKey || result.connection.clientKey,
              })
            );
          } catch (err) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: { message: err.message } }));
          }
          return;
        }

        if (action === 'sendPin') {
          const poolKey = `${ip}:${targetPort}`;
          let conn = connectionPool.get(poolKey);
          if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
            const resInit = await createTvSocket(ip, targetPort, useSecureWs, undefined, 'PIN');
            conn = resInit.connection;
          }

          const reqId = `pin_${Date.now()}`;
          const pinHandler = (data) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.type === 'registered') {
                conn.ws.off('message', pinHandler);
                const retKey = msg.payload?.['client-key'];
                if (retKey) saveKeyForIp(ip, retKey);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, clientKey: retKey }));
              } else if (msg.id === reqId && (msg.type === 'error' || msg.payload?.returnValue === false)) {
                conn.ws.off('message', pinHandler);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: { message: 'Incorrect PIN code entered.' } }));
              }
            } catch {}
          };

          conn.ws.on('message', pinHandler);
          conn.ws.send(JSON.stringify({ id: reqId, type: 'request', uri: LG_SSAP_URIS.SET_PIN, payload: { pin: String(pin).trim() } }));
          return;
        }

        if (action === 'command') {
          const { connection } = await createTvSocket(ip, targetPort, useSecureWs, clientKey);
          const id = `cmd_${Date.now()}`;
          const cmdHandler = (data) => {
            try {
              const msg = JSON.parse(data.toString());
              if (msg.id === id) {
                connection.ws.off('message', cmdHandler);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: msg.payload }));
              }
            } catch {}
          };
          connection.ws.on('message', cmdHandler);
          connection.ws.send(JSON.stringify({ id, type: 'request', uri, payload }));
          return;
        }

        if (action === 'pointerButton') {
          const { connection } = await createTvSocket(ip, targetPort, useSecureWs, clientKey);
          if (!connection.pointerWs || connection.pointerWs.readyState !== WebSocket.OPEN) {
            try {
              const ptrRes = await new Promise((resP) => {
                const id = `ptr_${Date.now()}`;
                const h = (d) => {
                  try {
                    const m = JSON.parse(d.toString());
                    if (m.id === id) {
                      connection.ws.off('message', h);
                      resP(m.payload || {});
                    }
                  } catch {}
                };
                connection.ws.on('message', h);
                connection.ws.send(JSON.stringify({ id, type: 'request', uri: LG_SSAP_URIS.GET_POINTER_INPUT_SOCKET }));
              });

              if (ptrRes.socketPath) {
                connection.pointerWs = new WebSocket(ptrRes.socketPath, { rejectUnauthorized: false });
                await new Promise((r) => {
                  connection.pointerWs.on('open', r);
                  setTimeout(r, 1500);
                });
              }
            } catch {}
          }

          if (connection.pointerWs && connection.pointerWs.readyState === WebSocket.OPEN) {
            connection.pointerWs.send(`type:button\nname:${key}\n\n`);
          } else if (key === 'ENTER') {
            connection.ws.send(JSON.stringify({ id: `ent_${Date.now()}`, type: 'request', uri: LG_SSAP_URIS.SEND_ENTER_KEY }));
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Unknown action' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { message: err.message } }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`\n=================================================`);
  console.log(`  LG Control - Local Bridge Running`);
  console.log(`  Listening on: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`  CORS & Chrome Private Network Access: ENABLED`);
  console.log(`  TV Self-Signed TLS Handling: ENABLED`);
  console.log(`=================================================\n`);
});
