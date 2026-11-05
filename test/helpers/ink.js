import { inflateSync } from 'node:zlib';
// A browser's screenshot, as pixels: no image library is a dependency of this package.
// Decodes an 8-bit RGB or RGBA PNG, as a browser's screenshot is.
export function decodePng(buffer) {
  let offset = 8, width, height, channels;
  const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); channels = { 2: 3, 6: 4 }[body[9]]; if (body[8] !== 8 || !channels || body[12]) throw new Error('Unsupported PNG'); }
    if (type === 'IDAT') data.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x];
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const b = y ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= channels && y ? pixels[(y - 1) * stride + x - channels] : 0;
      let add = 0;
      if (filter === 1) add = a; else if (filter === 2) add = b; else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      pixels[y * stride + x] = (value + add) & 255;
    }
  }
  return { width, height, channels, pixels };
}
// What in the image differs from its top-left pixel: the bounds of the ink, in image pixels.
export function inkBounds({ width, height, channels, pixels }, threshold = 96) {
  let top = Infinity, bottom = -1, left = Infinity, right = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let difference = 0;
    for (let c = 0; c < 3; c++) difference = Math.max(difference, Math.abs(pixels[(y * width + x) * channels + c] - pixels[c]));
    if (difference >= threshold) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  }
  return bottom < 0 ? null : { top, bottom: bottom + 1, left, right: right + 1 };
}
