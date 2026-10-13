// Gera ícones estáticos PNG (512 e 180) — sem @vercel/og.
// Fundo em gradiente teal com símbolo de "broadcast" (ondas + ponto).
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function genPng(size) {
  const W = size, H = size;
  // Gradiente diagonal teal -> ciano
  const c1 = [15, 118, 110];    // #0f766e
  const c2 = [14, 165, 233];    // #0ea5e9
  const px = Buffer.alloc(W * H * 4);

  // Símbolo: ponto + arcos de sinal (canto inferior esquerdo)
  const cx = 0.30 * W, cy = 0.70 * H;
  const thick = 0.055 * W;
  const rings = [0.17 * W, 0.30 * W, 0.43 * W];
  const dotR = 0.075 * W;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // fundo
      const t = (x / W + y / H) / 2;
      let r = lerp(c1[0], c2[0], t);
      let g = lerp(c1[1], c2[1], t);
      let b = lerp(c1[2], c2[2], t);

      // arcos de sinal
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ang = Math.atan2(dy, dx); // -PI..PI (y para baixo)
      //扇区 apontando para cima/direita: -170° a -10°
      const deg = (ang * 180) / Math.PI;
      let arcA = 0;
      if (deg > -175 && deg < -5) {
        // borda suave do setor
        const edge = Math.min(deg + 175, -5 - deg, 14) / 14;
        for (const rr of rings) {
          const d = Math.abs(dist - rr) - thick / 2;
          const aa = Math.max(0, Math.min(0.5 - d / 1.5, 1));
          arcA = Math.max(arcA, aa * Math.max(0, Math.min(edge, 1)));
        }
      }
      // ponto central
      const dd = dist - dotR;
      const dotA = Math.max(0, Math.min(0.5 - dd / 1.5, 1));

      const a = Math.max(arcA, dotA);
      if (a > 0) {
        r = lerp(r, 255, a);
        g = lerp(g, 255, a);
        b = lerp(b, 255, a);
      }

      const o = (y * W + x) * 4;
      px[o] = Math.round(r); px[o + 1] = Math.round(g);
      px[o + 2] = Math.round(b); px[o + 3] = 255;
    }
  }

  // scanlines com filtro 0
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const pub = path.join(__dirname, '..', 'public');
fs.mkdirSync(pub, { recursive: true });
fs.writeFileSync(path.join(pub, 'icon-512.png'), genPng(512));
fs.writeFileSync(path.join(pub, 'apple-icon-180.png'), genPng(180));
console.log('OK: public/icon-512.png + public/apple-icon-180.png');
