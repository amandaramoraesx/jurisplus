import sharp from "sharp";
import { writeFileSync } from "fs";

const ACCENT = "#6b46b0";
const ACCENT_DARK = "#3d2563";

function svgIcone({ size, padding, maskable = false }) {
  // Ícones "maskable" precisam preencher o quadrado até a borda (sem cantos
  // arredondados aqui) porque é o próprio sistema quem aplica o recorte final.
  const r = maskable ? 0 : size * 0.22;
  const jSize = size * (1 - padding * 2);
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = jSize * 0.62;

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="100%" stop-color="${ACCENT_DARK}"/>
    </linearGradient>
    <radialGradient id="shine" cx="30%" cy="22%" r="65%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#shine)"/>
  <text x="${cx}" y="${cy}" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">J+</text>
</svg>`;
}

async function gerarPng(path, size, padding, maskable = false) {
  const svg = svgIcone({ size, padding, maskable });
  await sharp(Buffer.from(svg)).png().toFile(path);
  console.log("gerado:", path, `${size}x${size}`);
}

async function main() {
  const base = "/home/user/jurisplus/public";
  await gerarPng(`${base}/icon-192.png`, 192, 0.12);
  await gerarPng(`${base}/icon-512.png`, 512, 0.12);
  await gerarPng(`${base}/icon-maskable-512.png`, 512, 0.24, true);
  await gerarPng(`${base}/apple-touch-icon.png`, 180, 0.1);

  // favicon.ico: monta um ICO real (header + entradas) embrulhando PNGs de 16/32/48
  const tamanhos = [16, 32, 48];
  const pngBuffers = [];
  for (const tam of tamanhos) {
    const svg = svgIcone({ size: tam, padding: 0.1 });
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    pngBuffers.push({ tam, buf });
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(pngBuffers.length, 4); // count

  const entries = [];
  let offset = 6 + 16 * pngBuffers.length;
  for (const { tam, buf } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(tam >= 256 ? 0 : tam, 0); // width
    entry.writeUInt8(tam >= 256 ? 0 : tam, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset
    entries.push(entry);
    offset += buf.length;
  }

  const ico = Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buf)]);
  writeFileSync(`${base}/favicon.ico`, ico);
  console.log("gerado:", `${base}/favicon.ico`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
