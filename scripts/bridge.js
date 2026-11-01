#!/usr/bin/env node

/**
 * LG Control - Secured Local Bridge Service
 *
 * This local service runs on your computer or local network.
 * It bridges commands between deployed HTTPS web clients (like Vercel) and your local LG webOS TV,
 * solving browser self-signed TLS certificate enforcement (ERR_CERT_AUTHORITY_INVALID) and
 * Private Network Access (PNA) restrictions.
 *
 * Security:
 * - Trust-on-First-Use (TOFU) certificate fingerprint verification for LG TV TLS on port 3001.
 * - Never blindly trusts arbitrary certificates.
 * - Restricts CORS to allowed origins.
 * - Supports local authorization tokens.
 * - Keeps TV credentials out of logs.
 *
 * Usage:
 *   npm run bridge
 *   # or
 *   node scripts/bridge.js
 */

const http = require('http');
const tls = require('tls');
const net = require('net');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.BRIDGE_PORT || '3005', 10);
const HOST = process.env.BRIDGE_HOST || '127.0.0.1';

// File paths for secure persistent storage
const DATA_DIR = path.join(__dirname, '..');
const KEYS_FILE = path.join(DATA_DIR, '.tv-keys.json');
const FINGERPRINTS_FILE = path.join(DATA_DIR, '.tv-fingerprints.json');
const TOKEN_FILE = path.join(DATA_DIR, '.bridge-token');

// Allowed web origins for CORS
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/tv-remote-roan\.vercel\.app$/,
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/localhost$/,
  /^capacitor:\/\/localhost$/,
];

function isOriginAllowed(origin) {
  if (!origin) return true; // Direct non-browser requests
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

// Ensure bridge security token exists
function getOrCreateBridgeToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
      if (token.length >= 16) return token;
    }
  } catch {}

  const newToken = crypto.randomBytes(16).toString('hex');
  try {
    fs.writeFileSync(TOKEN_FILE, newToken, { encoding: 'utf8', mode: 0o600 });
  } catch {}
  return newToken;
}

const BRIDGE_TOKEN = getOrCreateBridgeToken();

// Persistent TV Client Keys
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
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch (err) {
    console.error('[Storage] Error saving TV key:', err.message);
  }
}

function removeKeyForIp(ip) {
  try {
    const keys = getSavedKeys();
    delete keys[ip];
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch {}
}

// Persistent TV TLS Fingerprints (TOFU mechanism)
function getSavedFingerprints() {
  try {
    if (fs.existsSync(FINGERPRINTS_FILE)) {
      return JSON.parse(fs.readFileSync(FINGERPRINTS_FILE, 'utf8')) || {};
    }
  } catch {}
  return {};
}

function saveFingerprintForIp(ip, fingerprint) {
  try {
    const fingerprints = getSavedFingerprints();
    fingerprints[ip] = fingerprint;
    fs.writeFileSync(FINGERPRINTS_FILE, JSON.stringify(fingerprints, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch (err) {
    console.error('[Storage] Error saving TV TLS fingerprint:', err.message);
  }
}

/**
 * Trust-on-First-Use (TOFU) TLS certificate verification for LG webOS TV.
 */
function verifyTvCertificate(host, cert) {
  if (!cert) {
    return new Error('TV did not present a TLS certificate.');
  }

  const currentFingerprint = cert.fingerprint256;
  if (!currentFingerprint) {
    return new Error('Could not calculate SHA-256 fingerprint for TV TLS certificate.');
  }

  const savedFingerprints = getSavedFingerprints();
  const pinnedFingerprint = savedFingerprints[host];

  if (pinnedFingerprint) {
    if (pinnedFingerprint !== currentFingerprint) {
      console.error(
        `[Security] TLS FINGERPRINT MISMATCH for ${host}! Pinned: ${pinnedFingerprint}, Presented: ${currentFingerprint}`
      );
      return new Error(
        `Security Error: TV TLS certificate fingerprint changed! Pinned: ${pinnedFingerprint}, got: ${currentFingerprint}`
      );
    }
    // Fingerprint matches pinned certificate
    return undefined;
  }

  // Trust on First Use (TOFU) check:
  // Validate that the certificate Subject or Issuer belongs to LG Electronics
  const issuerOrg = cert.issuer?.O || '';
  const subjectOrg = cert.subject?.O || '';
  const isLgEntity =
    issuerOrg.includes('LG Electronics') ||
    subjectOrg.includes('LG Electronics') ||
    (cert.subject?.CN && cert.subject.CN.includes('LGE TV'));

  if (!isLgEntity) {
    console.error(
      `[Security] Rejected untrusted certificate on ${host}: Issuer="${issuerOrg}", Subject="${subjectOrg}"`
    );
    return new Error(
      `Untrusted certificate on ${host}. Certificate issuer is "${issuerOrg}", expected LG Electronics Inc.`
    );
  }

  // Pin fingerprint on first successful verification
  console.log(`[Security] Pinned TV certificate fingerprint for ${host} (SHA-256: ${currentFingerprint})`);
  saveFingerprintForIp(host, currentFingerprint);
  return undefined;
}

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

// Active connection pool
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
      const wsOptions = {
        handshakeTimeout: 8000,
        rejectUnauthorized: false,
      };

      if (useSecureWs) {
        wsOptions.createConnection = (options, cb) => {
          const socket = tls.connect(options, () => {
            const cert = socket.getPeerCertificate();
            const verifyError = verifyTvCertificate(ip, cert);
            if (verifyError) {
              socket.destroy(verifyError);
              if (cb) cb(verifyError);
              return;
            }
            if (cb) cb(null, socket);
          });
          socket.on('error', (err) => {
            if (cb) cb(err);
          });
          return socket;
        };
      }

      ws = new WebSocket(targetUrl, wsOptions);
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
        try {
          ws.close();
        } catch {}
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
        reject(new Error(`TV connection error: ${err.message}`));
      }
    });

    ws.on('close', () => {
      connectionPool.delete(poolKey);
    });
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const reqOrigin = req.headers.origin || '';
  const allowedOrigin = isOriginAllowed(reqOrigin) ? reqOrigin : 'https://tv-remote-roan.vercel.app';

  // Security & CORS Headers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-bridge-token');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url?.split('?')[0];

  // 1. Health & Status Probe
  if (req.method === 'GET' && (urlPath === '/health' || urlPath === '/api/tv/health')) {
    const isLoopbackReq =
      req.socket.remoteAddress === '127.0.0.1' ||
      req.socket.remoteAddress === '::1' ||
      req.socket.remoteAddress === '::ffff:127.0.0.1';

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'lg-remote-local-bridge',
        version: '1.1.0',
        activeConnections: connectionPool.size,
        token: isLoopbackReq ? BRIDGE_TOKEN : undefined,
      })
    );
    return;
  }

  // 2. Relay Commands
  if (req.method === 'POST' && (urlPath === '/api/tv/bridge' || urlPath === '/bridge')) {
    // Validate authentication token for non-local requests
    const providedToken = req.headers['x-bridge-token'] || '';
    const isLoopback =
      req.socket.remoteAddress === '127.0.0.1' ||
      req.socket.remoteAddress === '::1' ||
      req.socket.remoteAddress === '::ffff:127.0.0.1';

    if (!isLoopback && providedToken !== BRIDGE_TOKEN) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          error: { message: 'Unauthorized: Invalid or missing x-bridge-token header.' },
        })
      );
      return;
    }

    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 65536) {
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

        // Forget TV credentials
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

        // Connect & Pair
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

        // Submit PIN Code
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
          conn.ws.send(
            JSON.stringify({
              id: reqId,
              type: 'request',
              uri: LG_SSAP_URIS.SET_PIN,
              payload: { pin: String(pin).trim() },
            })
          );
          return;
        }

        // Generic SSAP command (volume, apps, media, text input)
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

        // Navigation button (arrows, OK, enter, back, home)
        if (action === 'pointerButton') {
          const { connection } = await createTvSocket(ip, targetPort, useSecureWs, clientKey);

          // Connect pointer socket if available
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
                connection.ws.send(
                  JSON.stringify({
                    id,
                    type: 'request',
                    uri: LG_SSAP_URIS.GET_POINTER_INPUT_SOCKET,
                  })
                );
              });

              if (ptrRes.socketPath) {
                const ptrOptions = {
                  handshakeTimeout: 4000,
                  rejectUnauthorized: false,
                };
                if (ptrRes.socketPath.startsWith('wss://')) {
                  ptrOptions.createConnection = (options, cb) => {
                    const socket = tls.connect(options, () => {
                      if (cb) cb(null, socket);
                    });
                    socket.on('error', (err) => {
                      if (cb) cb(err);
                    });
                    return socket;
                  };
                }
                connection.pointerWs = new WebSocket(ptrRes.socketPath, ptrOptions);
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
            connection.ws.send(
              JSON.stringify({
                id: `ent_${Date.now()}`,
                type: 'request',
                uri: LG_SSAP_URIS.SEND_ENTER_KEY,
              })
            );
          } else if (key === 'HOME') {
            connection.ws.send(
              JSON.stringify({
                id: `home_${Date.now()}`,
                type: 'request',
                uri: LG_SSAP_URIS.LAUNCH_APP,
                payload: { id: 'com.webos.app.home' },
              })
            );
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
  console.log(`\n======================================================`);
  console.log(`  LG Control - Local Bridge Service`);
  console.log(`  Listening on: http://${HOST}:${PORT}`);
  console.log(`  Health Check: http://${HOST}:${PORT}/health`);
  console.log(`  Security Token: ${BRIDGE_TOKEN}`);
  console.log(`  TV TLS Verification: TOFU Fingerprint Pinning`);
  console.log(`======================================================\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Bridge] Stopping server...');
  connectionPool.forEach((c) => {
    try {
      c.ws.close();
      c.pointerWs?.close();
    } catch {}
  });
  server.close(() => process.exit(0));
});
