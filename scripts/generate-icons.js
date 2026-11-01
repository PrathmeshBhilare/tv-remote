const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPng(width, height, isMaskable = false) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // no filter
  ihdr[12] = 0; // no interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw pixel scanlines
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const nx = (x - cx) / radius; // -1 to 1
      const ny = (y - cy) / radius; // -1 to 1
      const dist = Math.sqrt(nx * nx + ny * ny);

      // Default background: deep cosmic dark #0B0E17 with radial subtle cyan glow
      let r = 11, g = 14, b = 23, a = 255;

      if (!isMaskable) {
        // Rounded corner squircle
        const cornerDist = Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4);
        if (cornerDist > 0.85) {
          // Transparent outside squircle
          a = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          continue;
        }
      }

      // Background ambient gradient
      const bgGlow = Math.max(0, 1 - dist * 1.1);
      r = Math.min(255, Math.floor(10 + bgGlow * 18));
      g = Math.min(255, Math.floor(14 + bgGlow * 30));
      b = Math.min(255, Math.floor(25 + bgGlow * 65));

      // Neon Ring / TV frame
      // TV body: rect from x: [-0.6, 0.6], y: [-0.45, 0.35]
      const inTvOuter = Math.abs(nx) < 0.62 && ny > -0.42 && ny < 0.38;
      const inTvScreen = Math.abs(nx) < 0.54 && ny > -0.34 && ny < 0.30;

      if (inTvOuter && !inTvScreen) {
        // Glowing cyan/blue outer bezel
        const bezelGrad = (nx + 0.6) / 1.2;
        r = Math.floor(14 + bezelGrad * 30);
        g = Math.floor(165 + bezelGrad * 40);
        b = 255;
      } else if (inTvScreen) {
        // Inside TV screen: rich glowing navy #0A1128 with center beam
        const screenGrad = Math.max(0, 1 - Math.sqrt(nx * nx + (ny + 0.02) * (ny + 0.02)) * 2);
        r = Math.floor(12 + screenGrad * 40);
        g = Math.floor(24 + screenGrad * 70);
        b = Math.floor(48 + screenGrad * 160);

        // Center D-Pad / Remote Beam Emblem: Glowing Play / Power symbol in center
        const centerDist = Math.sqrt(nx * nx + (ny + 0.02) * (ny + 0.02));
        if (centerDist < 0.16 && centerDist > 0.12) {
          // Cyan Ring
          r = 6;
          g = 182;
          b = 212;
        } else if (centerDist <= 0.08) {
          // Center core
          r = 0;
          g = 229;
          b = 255;
        }
      }

      // TV Stand: small bar at bottom: x: [-0.25, 0.25], y: [0.42, 0.46]
      const inStand = Math.abs(nx) < 0.25 && ny >= 0.42 && ny <= 0.46;
      const inNeck = Math.abs(nx) < 0.06 && ny >= 0.38 && ny < 0.42;
      if (inStand || inNeck) {
        r = 56;
        g = 189;
        b = 248;
      }

      // Signal Waves on top: arcs emitting above TV
      // Arc 1: radius ~0.65, ny < -0.42
      const topDist = Math.sqrt(nx * nx + (ny + 0.3) * (ny + 0.3));
      if (ny < -0.42) {
        if (Math.abs(topDist - 0.28) < 0.025 && Math.abs(nx) < 0.25) {
          r = 139; g = 92; b = 246; // Purple glow
        } else if (Math.abs(topDist - 0.38) < 0.028 && Math.abs(nx) < 0.35) {
          r = 6; g = 182; b = 212; // Cyan glow
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Generate all required icons
const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. icon-192.png
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createPng(192, 192, false));
console.log('Created icon-192.png');

// 2. icon-512.png
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createPng(512, 512, false));
console.log('Created icon-512.png');

// 3. icon-maskable-192.png
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192.png'), createPng(192, 192, true));
console.log('Created icon-maskable-192.png');

// 4. icon-maskable-512.png
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), createPng(512, 512, true));
console.log('Created icon-maskable-512.png');

// 5. apple-touch-icon.png (180x180)
fs.writeFileSync(path.join(process.cwd(), 'public', 'apple-touch-icon.png'), createPng(180, 180, true));
console.log('Created apple-touch-icon.png');

// 6. SVG Vector Icon for high-DPI displays & browser tab favicon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="50%" stop-color="#0B0E17"/>
      <stop offset="100%" stop-color="#06080F"/>
    </linearGradient>
    <linearGradient id="neonBeam" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="50%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
    <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0A101D"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Squircle -->
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#bgGrad)" stroke="url(#neonBeam)" stroke-width="4" stroke-opacity="0.5"/>

  <!-- Emitting Wireless Signal Arcs -->
  <path d="M 180 125 A 110 110 0 0 1 332 125" fill="none" stroke="#8B5CF6" stroke-width="12" stroke-linecap="round" opacity="0.8" filter="url(#glow)"/>
  <path d="M 210 155 A 70 70 0 0 1 302 155" fill="none" stroke="#06B6D4" stroke-width="12" stroke-linecap="round" filter="url(#glow)"/>

  <!-- TV Outer Frame -->
  <rect x="76" y="170" width="360" height="230" rx="28" fill="url(#screenGrad)" stroke="url(#neonBeam)" stroke-width="8" filter="url(#glow)"/>

  <!-- TV Screen Inner Border -->
  <rect x="94" y="188" width="324" height="194" rx="18" fill="#070A12" stroke="#1E293B" stroke-width="3"/>

  <!-- TV Stand -->
  <path d="M 236 400 L 236 432 L 276 432 L 276 400 Z" fill="#3B82F6" opacity="0.8"/>
  <rect x="176" y="432" width="160" height="14" rx="7" fill="url(#neonBeam)"/>

  <!-- Center Glowing Lumina Remote Emblem -->
  <circle cx="256" cy="285" r="48" fill="none" stroke="#06B6D4" stroke-width="8" filter="url(#glow)"/>
  <circle cx="256" cy="285" r="22" fill="#06B6D4"/>
  <path d="M 256 250 L 256 270" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.join(process.cwd(), 'public', 'favicon.svg'), svgIcon, 'utf8');
console.log('Created favicon.svg');

fs.writeFileSync(path.join(process.cwd(), 'public', 'favicon.ico'), createPng(64, 64, false));
console.log('Created favicon.ico');

console.log('All icons generated successfully!');

