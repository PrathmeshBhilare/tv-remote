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

// Generate Premium Vector SVG for LG Control
function getBrandSvg(width = 512, height = 512, isMaskable = false) {
  const rx = isMaskable ? 0 : 112;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${width}" height="${height}">
  <defs>
    <!-- Matte Charcoal Surface Gradient -->
    <linearGradient id="charcoalBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1A1B16" />
      <stop offset="60%" stop-color="#12130F" />
      <stop offset="100%" stop-color="#0E0F0C" />
    </linearGradient>

    <!-- Warm Olive / Champagne Accent Gradient -->
    <linearGradient id="oliveChampagne" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E8E2D0" />
      <stop offset="50%" stop-color="#D5CBA8" />
      <stop offset="100%" stop-color="#B6AD83" />
    </linearGradient>

    <!-- Deep Graphite Screen Fill -->
    <linearGradient id="screenFill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#191A15" />
      <stop offset="100%" stop-color="#10110E" />
    </linearGradient>

    <!-- D-Pad Radial -->
    <radialGradient id="dpadFill" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#2D2F26" />
      <stop offset="70%" stop-color="#22231C" />
      <stop offset="100%" stop-color="#171813" />
    </radialGradient>

    <!-- Outer Rim Subtle Gold Border -->
    <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D5CBA8" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#B6AD83" stop-opacity="0.1" />
    </linearGradient>
  </defs>

  <!-- Squircle Base Canvas -->
  <rect x="8" y="8" width="496" height="496" rx="${rx}" fill="url(#charcoalBg)" stroke="url(#goldBorder)" stroke-width="3" />

  <!-- Inner Soft Bevel Glow -->
  <rect x="14" y="14" width="484" height="484" rx="${Math.max(0, rx - 6)}" fill="none" stroke="rgba(241, 238, 227, 0.04)" stroke-width="2" />

  <!-- 1. WIRELESS SIGNAL WAVES (Top Center) -->
  <g transform="translate(256, 116)" stroke="url(#oliveChampagne)" fill="none" stroke-linecap="round">
    <!-- Outer Wave -->
    <path d="M -54 -12 A 56 56 0 0 1 54 -12" stroke-width="4.5" opacity="0.6" />
    <!-- Middle Wave -->
    <path d="M -34 4 A 36 36 0 0 1 34 4" stroke-width="5" opacity="0.85" />
    <!-- Inner Dot / Origin -->
    <circle cx="0" cy="18" r="4.5" fill="#D5CBA8" stroke="none" />
  </g>

  <!-- 2. MINIMAL TELEVISION OUTLINE -->
  <g transform="translate(106, 150)">
    <!-- TV Outer Frame (300 wide x 210 high) -->
    <rect x="0" y="0" width="300" height="210" rx="20" fill="url(#screenFill)" stroke="#F1EEE3" stroke-width="6.5" stroke-opacity="0.9" />

    <!-- TV Stand (Subtle architectural minimal base) -->
    <path d="M 120 214 L 105 240 L 195 240 L 180 214 Z" fill="#25261F" stroke="#B6AD83" stroke-width="2.5" stroke-opacity="0.6" stroke-linejoin="round" />
    <line x1="88" y1="240" x2="212" y2="240" stroke="#D5CBA8" stroke-width="3.5" stroke-linecap="round" stroke-opacity="0.8" />

    <!-- 3. INTEGRATED REMOTE CONTROLLER / D-PAD (Inside TV Screen) -->
    <g transform="translate(150, 105)">
      <!-- Directional Controller Outer Ring -->
      <circle cx="0" cy="0" r="62" fill="url(#dpadFill)" stroke="#B6AD83" stroke-width="2.5" stroke-opacity="0.5" />

      <!-- Directional Indicator Chevrons -->
      <!-- Up -->
      <path d="M -7 -38 L 0 -45 L 7 -38" fill="none" stroke="#D5CBA8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Down -->
      <path d="M -7 38 L 0 45 L 7 38" fill="none" stroke="#D5CBA8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Left -->
      <path d="M -38 -7 L -45 0 L -38 7" fill="none" stroke="#D5CBA8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Right -->
      <path d="M 38 -7 L 45 0 L 38 7" fill="none" stroke="#D5CBA8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Center OK Button -->
      <circle cx="0" cy="0" r="22" fill="#141511" stroke="#D5CBA8" stroke-width="2" />
      <circle cx="0" cy="0" r="5" fill="#D5CBA8" />
    </g>
  </g>
</svg>`;
}

// Generate PNG Icon using pure raster drawing
function renderBrandPng(size, isMaskable = false) {
  const width = size;
  const height = size;
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdr);
  const rawData = Buffer.alloc(height * (width * 4 + 1));
  const cx = width / 2;
  const cy = height / 2;
  const radius = width / 2;

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter: none
    const ny = (y - cy) / radius; // -1 to 1

    for (let x = 0; x < width; x++) {
      const nx = (x - cx) / radius; // -1 to 1

      // 1. Squircle Corner Clipping (if not maskable)
      if (!isMaskable) {
        const squircle = Math.pow(Math.abs(nx), 4.2) + Math.pow(Math.abs(ny), 4.2);
        if (squircle > 0.82) {
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          continue;
        }
      }

      // Default Canvas Color: Deep Warm Charcoal #10110E with subtle vertical gradient to #191A15
      const grad = (ny + 1) / 2;
      let r = Math.round(24 - grad * 8);
      let g = Math.round(26 - grad * 9);
      let b = Math.round(21 - grad * 7);
      let a = 255;

      // Fine Border Stroke
      if (!isMaskable) {
        const squircle = Math.pow(Math.abs(nx), 4.2) + Math.pow(Math.abs(ny), 4.2);
        if (squircle > 0.77 && squircle <= 0.82) {
          r = 182; g = 173; b = 131; // Muted olive #B6AD83 border
        }
      }

      // TV Coordinates (Normalized -1 to 1)
      // TV Screen: x in [-0.58, 0.58], y in [-0.38, 0.44]
      const tvLeft = -0.58;
      const tvRight = 0.58;
      const tvTop = -0.36;
      const tvBottom = 0.44;
      const strokeW = 0.024;

      // Wireless signal above TV (y around -0.65 to -0.45)
      const distFromCenterTop = Math.sqrt(nx * nx + (ny + 0.45) * (ny + 0.45));
      if (ny < -0.42) {
        // Outer wave arc
        if (distFromCenterTop > 0.28 && distFromCenterTop < 0.31 && Math.abs(nx) < 0.28) {
          r = 213; g = 203; b = 168; // #D5CBA8
        }
        // Inner wave arc
        else if (distFromCenterTop > 0.17 && distFromCenterTop < 0.20 && Math.abs(nx) < 0.18) {
          r = 241; g = 238; b = 227; // #F1EEE3
        }
        // Center Signal Dot
        else if (distFromCenterTop < 0.035) {
          r = 213; g = 203; b = 168;
        }
      }

      // TV Outer Frame Border
      const inTvX = nx >= tvLeft && nx <= tvRight;
      const inTvY = ny >= tvTop && ny <= tvBottom;
      const onBorderX = (Math.abs(nx - tvLeft) < strokeW || Math.abs(nx - tvRight) < strokeW) && inTvY;
      const onBorderY = (Math.abs(ny - tvTop) < strokeW || Math.abs(ny - tvBottom) < strokeW) && inTvX;

      if (onBorderX || onBorderY) {
        // Warm ivory television frame
        r = 241; g = 238; b = 227;
      } else if (inTvX && inTvY) {
        // Inside TV Screen: Deep dark graphite #141511
        r = 20; g = 21; b = 17;

        // Remote Navigation Pad (Center of TV screen at (0, 0.04))
        const dpadDist = Math.sqrt(nx * nx + (ny - 0.04) * (ny - 0.04));

        // Outer D-Pad Ring
        if (dpadDist <= 0.26) {
          // Graphite circle surface
          r = 37; g = 38; b = 31; // #25261F

          // D-Pad Outer Ring border
          if (dpadDist > 0.245 && dpadDist <= 0.26) {
            r = 182; g = 173; b = 131; // #B6AD83
          }

          // Directional Arrows
          // Up indicator
          if (Math.abs(nx) < 0.04 && ny < -0.10 && ny > -0.19) {
            r = 213; g = 203; b = 168;
          }
          // Down indicator
          else if (Math.abs(nx) < 0.04 && ny > 0.18 && ny < 0.27) {
            r = 213; g = 203; b = 168;
          }
          // Left indicator
          else if (Math.abs(ny - 0.04) < 0.04 && nx < -0.14 && nx > -0.23) {
            r = 213; g = 203; b = 168;
          }
          // Right indicator
          else if (Math.abs(ny - 0.04) < 0.04 && nx > 0.14 && nx < 0.23) {
            r = 213; g = 203; b = 168;
          }

          // Center OK Button
          if (dpadDist <= 0.09) {
            r = 16; g = 17; b = 14; // #10110E
            if (dpadDist > 0.08) {
              r = 213; g = 203; b = 168; // soft champagne outline
            }
          }
        }
      }

      // TV Stand Base
      if (ny >= tvBottom && ny <= tvBottom + 0.09 && Math.abs(nx) <= 0.32) {
        if (ny > tvBottom + 0.075 || Math.abs(nx) < 0.08) {
          r = 182; g = 173; b = 131; // subtle champagne stand
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Generate simple multi-size ICO
function generateIco(png16, png32) {
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // ICO type
  icoHeader.writeUInt16LE(2, 4); // 2 images

  const entry1 = Buffer.alloc(16);
  entry1[0] = 16;
  entry1[1] = 16;
  entry1[2] = 0;
  entry1[3] = 0;
  entry1.writeUInt16LE(1, 4);
  entry1.writeUInt16LE(32, 6);
  entry1.writeUInt32LE(png16.length, 8);
  entry1.writeUInt32LE(6 + 32, 12);

  const entry2 = Buffer.alloc(16);
  entry2[0] = 32;
  entry2[1] = 32;
  entry2[2] = 0;
  entry2[3] = 0;
  entry2.writeUInt16LE(1, 4);
  entry2.writeUInt16LE(32, 6);
  entry2.writeUInt32LE(png32.length, 8);
  entry2.writeUInt32LE(6 + 32 + png16.length, 12);

  return Buffer.concat([icoHeader, entry1, entry2, png16, png32]);
}

// Write all assets
console.log('Generating luxury LG Control brand icons...');
const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// 1. Vector SVG
const brandSvg = getBrandSvg(512, 512, false);
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), brandSvg, 'utf8');
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), brandSvg, 'utf8');

// 2. High-Res PNGs
const png512 = renderBrandPng(512, false);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), png512);
fs.writeFileSync(path.join(publicDir, 'icon.png'), png512);

const png192 = renderBrandPng(192, false);
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), png192);

const maskable192 = renderBrandPng(192, true);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-192.png'), maskable192);

const maskable512 = renderBrandPng(512, true);
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), maskable512);

const appleIcon = renderBrandPng(180, false);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);

// 3. ICO
const png16 = renderBrandPng(16, false);
const png32 = renderBrandPng(32, false);
const icoData = generateIco(png16, png32);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoData);

console.log('Successfully generated all LG Control branding assets!');

