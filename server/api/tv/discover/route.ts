import { NextResponse } from 'next/server';
import os from 'os';
import net from 'net';
import dgram from 'dgram';

export const dynamic = 'force-dynamic';

// Fast TCP probe to check if TV SSAP port is open
function probePort(ip: string, port = 3001, timeoutMs = 600): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, ip, () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('error', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on('timeout', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(false);
      }
    });
  });
}

export async function GET() {
  const discoveredDevices: Array<{
    ip: string;
    name: string;
    port: number;
    useSecureWs: boolean;
  }> = [];

  const foundIps = new Set<string>();

  // 1. Check known TV IP or common default IP immediately (<300ms)
  const candidateIps = ['192.168.1.10'];

  // Add IPs from local network interface subnet
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const iface of netList) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const parts = iface.address.split('.');
          if (parts.length === 4) {
            const subnetPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
            // Add common TV IP offsets in home LAN
            for (const offset of [10, 15, 20, 25, 30, 40, 50, 100, 101, 150, 200]) {
              const testIp = `${subnetPrefix}.${offset}`;
              if (testIp !== iface.address && !candidateIps.includes(testIp)) {
                candidateIps.push(testIp);
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore network interface enumeration errors
  }

  // 2. Fast parallel probe for port 3001 (webOS SSAP SSL port)
  const probePromises = candidateIps.map(async (ip) => {
    const isOpen = await probePort(ip, 3001, 600);
    if (isOpen && !foundIps.has(ip)) {
      foundIps.add(ip);
      discoveredDevices.push({
        ip,
        name: ip === '192.168.1.10' ? 'LG webOS Smart TV' : `LG webOS TV (${ip})`,
        port: 3001,
        useSecureWs: true,
      });
    }
  });

  // 3. SSDP discovery in parallel
  const ssdpPromise = new Promise<void>((resolve) => {
    try {
      const client = dgram.createSocket('udp4');
      const ssdpMessage = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
        'HOST: 239.255.255.250:1900\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 2\r\n' +
        'ST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n' +
        '\r\n'
      );

      client.on('message', (msg, rinfo) => {
        const text = msg.toString().toLowerCase();
        if (text.includes('lg') || text.includes('webos') || text.includes('mediarenderer')) {
          if (!foundIps.has(rinfo.address)) {
            foundIps.add(rinfo.address);
            discoveredDevices.push({
              ip: rinfo.address,
              name: 'LG webOS Smart TV',
              port: 3001,
              useSecureWs: true,
            });
          }
        }
      });

      client.on('error', () => {
        try { client.close(); } catch {}
        resolve();
      });

      client.bind(0, () => {
        try {
          client.send(ssdpMessage, 0, ssdpMessage.length, 1900, '239.255.255.250');
        } catch {}
      });

      setTimeout(() => {
        try { client.close(); } catch {}
        resolve();
      }, 1000);
    } catch {
      resolve();
    }
  });

  // Wait for fast probes and SSDP (max 1.2s total)
  await Promise.all([Promise.all(probePromises), ssdpPromise]);

  // Fallback: If 192.168.1.10 wasn't added yet, add it as default TV profile
  if (discoveredDevices.length === 0) {
    discoveredDevices.push({
      ip: '192.168.1.10',
      name: 'LG webOS Smart TV',
      port: 3001,
      useSecureWs: true,
    });
  }

  return NextResponse.json({
    success: true,
    devices: discoveredDevices,
  });
}
