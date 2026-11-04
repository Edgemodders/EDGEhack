// A small PNG reader and writer, enough to cut an icon out of an atlas texture that REDbridge has
// written as PNG (texture.toPng: 8-bit RGBA, not interlaced). Pure, no VS Code.
import * as zlib from "node:zlib";

export interface Image {
  width: number;
  height: number;
  /** RGBA, 4 bytes a pixel, rows top to bottom. */
  data: Uint8Array;
}

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Reads an 8-bit RGBA or RGB PNG, not interlaced. Throws on anything else. */
export function decodePng(file: Uint8Array): Image {
  const buf = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("Not a PNG file");
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      colorType = body[9];
      const interlace = body[12];
      if (depth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0) {
        throw new Error(`Unsupported PNG: depth ${depth}, colour type ${colorType}, interlace ${interlace}`);
      }
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    pos += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[x] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = cur[x * channels];
      out[o + 1] = cur[x * channels + 1];
      out[o + 2] = cur[x * channels + 2];
      out[o + 3] = channels === 4 ? cur[x * channels + 3] : 255;
    }
    prev = cur;
  }
  return { width, height, data: out };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Writes an RGBA PNG. */
export function encodePng(image: Image): Buffer {
  const { width, height, data } = image;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

let table: Uint32Array | undefined;
function crc32(bytes: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A rectangle in UV coordinates (0 to 1, top to bottom), as an atlas part gives it. */
export interface UvRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Cuts a UV rectangle out of an image. */
export function crop(image: Image, uv: UvRect): Image {
  const x0 = clamp(Math.round(Math.min(uv.left, uv.right) * image.width), 0, image.width);
  const x1 = clamp(Math.round(Math.max(uv.left, uv.right) * image.width), 0, image.width);
  const y0 = clamp(Math.round(Math.min(uv.top, uv.bottom) * image.height), 0, image.height);
  const y1 = clamp(Math.round(Math.max(uv.top, uv.bottom) * image.height), 0, image.height);
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const from = ((y0 + y) * image.width + x0) * 4;
    data.set(image.data.subarray(from, from + width * 4), y * width * 4);
  }
  return { width, height, data };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
