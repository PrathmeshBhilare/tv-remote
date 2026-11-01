// Ensure ws uses pure JavaScript buffer utilities and does not attempt to load optional C++ addons
if (typeof process !== 'undefined') {
  process.env.WS_NO_BUFFER_UTIL = '1';
  process.env.WS_NO_UTF_8_VALIDATE = '1';
}

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';
import { LG_PERMISSIONS_MANIFEST, LG_SSAP_URIS } from '../../../../src/integrations/lg-webos/commands';

interface ServerConnection {
  ws: WebSocket;
  ip: string;
  port: number;
  useSecureWs: boolean;
  clientKey?: string;
  isPaired: boolean;
  lastUsed: number;
  pointerWs?: WebSocket;
}

// Persistent key storage file on disk
const KEYS_FILE = path.join(process.cwd(), '.tv-keys.json');

function getSavedKeys(): Record<string, string> {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const data = fs.readFileSync(KEYS_FILE, 'utf8');
      return JSON.parse(data) || {};
    }
  } catch {}
  return {};
}

function saveKeyForIp(ip: string, key: string): void {
  try {
    const keys = getSavedKeys();
    keys[ip] = key;
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
  } catch {}
}

function removeKeyForIp(ip: string): void {
  try {
    const keys = getSavedKeys();
    delete keys[ip];
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
  } catch {}
}

// Global connection pool
const connectionPool = new Map<string, ServerConnection>();

function createTvSocket(
  ip: string,
  port = 3001,
  useSecureWs = true,
  clientKey?: string,
  pairingType?: 'PROMPT' | 'PIN'
): Promise<{ connection: ServerConnection; requiresPin?: boolean; requiresPrompt?: boolean; newClientKey?: string }> {
  const poolKey = `${ip}:${port}`;
  const existing = connectionPool.get(poolKey);

  // If already paired and active, reuse existing connection
  if (existing && existing.ws.readyState === WebSocket.OPEN && existing.isPaired) {
    existing.lastUsed = Date.now();
    return Promise.resolve({ connection: existing, newClientKey: existing.clientKey });
  }

  // Clean up stale socket
  if (existing) {
    try {
      existing.ws.close();
      existing.pointerWs?.close();
    } catch {}
    connectionPool.delete(poolKey);
  }

  // Read saved key from disk if not explicitly passed
  const effectiveKey = clientKey || getSavedKeys()[ip];

  return new Promise((resolve, reject) => {
    const protocol = useSecureWs ? 'wss' : 'ws';
    const targetUrl = `${protocol}://${ip}:${port}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(targetUrl, {
        rejectUnauthorized: false, // Bypass self-signed SSL certificate on LG webOS TVs
        handshakeTimeout: 8000,
      });
    } catch (err) {
      return reject(new Error(`Failed to create WebSocket to ${targetUrl}: ${err}`));
    }

    const conn: ServerConnection = {
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
      // If we have a saved clientKey, NEVER request a new PIN!
      // Only include pairingType if no clientKey exists
      const regPayload: Record<string, unknown> = {
        forcePairing: false,
        manifest: LG_PERMISSIONS_MANIFEST,
      };

      if (effectiveKey) {
        regPayload['client-key'] = effectiveKey;
      } else {
        regPayload.pairingType = pairingType || 'PIN';
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

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());

        // 1. If we provided a clientKey and TV accepted it:
        if (msg.type === 'registered') {
          const key = msg.payload?.['client-key'] || effectiveKey;
          conn.clientKey = key;
          conn.isPaired = true;
          connectionPool.set(poolKey, conn);
          if (key) {
            saveKeyForIp(ip, key);
          }

          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve({ connection: conn, newClientKey: key });
          }
          return;
        }

        // 2. If no clientKey was provided, check if TV requests PIN or Prompt:
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

        // 3. If saved key was rejected by TV (e.g. revoked in TV settings):
        if (effectiveKey && msg.type === 'error' && msg.id === 'register_0') {
          removeKeyForIp(ip);
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            connectionPool.set(poolKey, conn);
            // Fall back to requesting new PIN
            return resolve({ connection: conn, requiresPin: true });
          }
        }
      } catch {
        // ignore parse errors
      }
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      ip,
      port = 3001,
      useSecureWs = true,
      clientKey,
      pairingType,
      pin,
      uri,
      payload,
      key,
    } = body;

    if (!ip) {
      return NextResponse.json({ success: false, error: { message: 'Missing TV IP address.' } }, { status: 400 });
    }

    const targetPort = Number(port) || 3001;
    const isSecure = typeof useSecureWs === 'boolean' ? useSecureWs : true;

    // 0. FORGET TV KEY (explicit wipe)
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
      return NextResponse.json({ success: true, message: 'TV credentials removed.' });
    }

    // 1. CONNECT & PAIR
    if (action === 'connect') {
      try {
        const result = await createTvSocket(ip, targetPort, isSecure, clientKey, pairingType);

        return NextResponse.json({
          success: result.connection.isPaired,
          requiresPin: result.requiresPin,
          requiresPrompt: result.requiresPrompt,
          clientKey: result.newClientKey || result.connection.clientKey,
          port: result.connection.port,
          useSecureWs: result.connection.useSecureWs,
        });
      } catch (err) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'CONNECT_FAILED',
            message: err instanceof Error ? err.message : 'Could not connect to TV on local Wi-Fi.',
          },
        });
      }
    }

    // 2. SUBMIT PIN CODE
    if (action === 'sendPin') {
      if (!pin) {
        return NextResponse.json({ success: false, error: { message: 'Missing PIN code.' } }, { status: 400 });
      }

      const poolKey = `${ip}:${targetPort}`;
      let conn = connectionPool.get(poolKey);

      // If connection not in pool or closed, re-open
      if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
        const res = await createTvSocket(ip, targetPort, isSecure, undefined, 'PIN');
        conn = res.connection;
      }

      return new Promise<NextResponse>((resolve) => {
        const reqId = `pin_${Date.now()}`;
        const timeout = setTimeout(() => {
          resolve(
            NextResponse.json({
              success: false,
              error: { code: 'PIN_TIMEOUT', message: 'PIN verification timed out.' },
            })
          );
        }, 15000);

        const handler = (data: WebSocket.Data) => {
          try {
            const msg = JSON.parse(data.toString());
            // TV returns 'registered' on successful PIN
            if (msg.type === 'registered') {
              clearTimeout(timeout);
              conn?.ws.off('message', handler);
              const returnedKey = msg.payload?.['client-key'];
              if (conn) {
                conn.clientKey = returnedKey;
                conn.isPaired = true;
              }
              if (returnedKey) {
                saveKeyForIp(ip, returnedKey);
              }
              resolve(NextResponse.json({ success: true, clientKey: returnedKey }));
            }
            // TV returns error if PIN was wrong
            else if (
              msg.id === reqId &&
              (msg.type === 'error' || msg.payload?.returnValue === false || msg.payload?.errorCode === -1000)
            ) {
              clearTimeout(timeout);
              conn?.ws.off('message', handler);
              resolve(
                NextResponse.json({
                  success: false,
                  error: { code: 'INCORRECT_PIN', message: 'Incorrect PIN code entered. Check TV screen.' },
                })
              );
            }
          } catch {
            // ignore parse errors
          }
        };

        conn!.ws.on('message', handler);

        const setPinMsg = {
          id: reqId,
          type: 'request',
          uri: LG_SSAP_URIS.SET_PIN,
          payload: { pin: String(pin).trim() },
        };

        conn!.ws.send(JSON.stringify(setPinMsg));
      });
    }

    // 3. EXECUTE SSAP COMMAND (Volume, Mute, Apps, Media)
    if (action === 'command') {
      if (!uri) {
        return NextResponse.json({ success: false, error: { message: 'Missing command URI.' } }, { status: 400 });
      }

      const { connection } = await createTvSocket(ip, targetPort, isSecure, clientKey);
      if (!connection.ws || connection.ws.readyState !== WebSocket.OPEN) {
        return NextResponse.json({ success: false, error: { message: 'TV is not connected.' } });
      }

      return new Promise<NextResponse>((resolve) => {
        const id = `cmd_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const timeout = setTimeout(() => {
          resolve(
            NextResponse.json({
              success: false,
              error: { code: 'TIMEOUT', message: `Command ${uri} timed out.` },
            })
          );
        }, 5000);

        const handler = (data: WebSocket.Data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.id === id) {
              clearTimeout(timeout);
              connection.ws.off('message', handler);
              if (msg.type === 'error' || msg.payload?.returnValue === false) {
                resolve(
                  NextResponse.json({
                    success: false,
                    error: {
                      code: 'COMMAND_ERROR',
                      message: msg.error || msg.payload?.errorText || 'Command failed on TV',
                    },
                  })
                );
              } else {
                resolve(NextResponse.json({ success: true, data: msg.payload }));
              }
            }
          } catch {
            // ignore
          }
        };

        connection.ws.on('message', handler);

        connection.ws.send(
          JSON.stringify({
            id,
            type: 'request',
            uri,
            payload,
          })
        );
      });
    }

    // 4. NAVIGATION KEYS (Directional arrows, OK, Home, Back)
    if (action === 'pointerButton') {
      if (!key) {
        return NextResponse.json({ success: false, error: { message: 'Missing key.' } }, { status: 400 });
      }

      const { connection } = await createTvSocket(ip, targetPort, isSecure, clientKey);

      // Initialize pointer input socket if needed for navigation/OK keys
      if (!connection.pointerWs || connection.pointerWs.readyState !== WebSocket.OPEN) {
        try {
          const socketRes = await new Promise<{ socketPath?: string }>((resPromise, rejPromise) => {
            const id = `ptr_${Date.now()}`;
            const to = setTimeout(() => rejPromise(new Error('Timeout getting pointer path')), 3000);
            const ptrHandler = (data: WebSocket.Data) => {
              try {
                const m = JSON.parse(data.toString());
                if (m.id === id) {
                  clearTimeout(to);
                  connection.ws.off('message', ptrHandler);
                  resPromise(m.payload || {});
                }
              } catch {}
            };
            connection.ws.on('message', ptrHandler);
            connection.ws.send(
              JSON.stringify({
                id,
                type: 'request',
                uri: LG_SSAP_URIS.GET_POINTER_INPUT_SOCKET,
              })
            );
          });

          if (socketRes.socketPath) {
            connection.pointerWs = new WebSocket(socketRes.socketPath, {
              rejectUnauthorized: false,
            });
            await new Promise<void>((pRes) => {
              connection.pointerWs!.on('open', () => pRes());
              setTimeout(() => pRes(), 2000);
            });
          }
        } catch {}
      }

      // Send to active pointer socket
      if (connection.pointerWs && connection.pointerWs.readyState === WebSocket.OPEN) {
        connection.pointerWs.send(`type:button\nname:${key}\n\n`);
        return NextResponse.json({ success: true });
      }

      // Fallbacks if pointer socket is not available:
      if (key === 'ENTER') {
        connection.ws.send(
          JSON.stringify({
            id: `enter_${Date.now()}`,
            type: 'request',
            uri: LG_SSAP_URIS.SEND_ENTER_KEY,
          })
        );
        return NextResponse.json({ success: true });
      }

      if (key === 'HOME') {
        connection.ws.send(
          JSON.stringify({
            id: `home_${Date.now()}`,
            type: 'request',
            uri: LG_SSAP_URIS.LAUNCH_APP,
            payload: { id: 'com.webos.app.home' },
          })
        );
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: { message: `Unknown action: ${action}` } }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_BRIDGE_ERROR',
          message: err instanceof Error ? err.message : 'Unknown bridge error',
        },
      },
      { status: 500 }
    );
  }
}
