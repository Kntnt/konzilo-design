// What a test reads from a WOFF2 font file: the tables it holds and the characters its cmap maps. A WOFF2 file is a
// table directory and one Brotli stream with the tables one after another (WOFF File Format 2.0, 5 and 6). Only a
// table stored untransformed is returned, which is every table but glyf, loca and, at times, hmtx.
import { brotliDecompressSync } from 'node:zlib';

// The tags a directory entry names by their index, its flags' low six bits (WOFF2, 5.1, the known table tags).
const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
  'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
  'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat',
  'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat',
  'Sill'];

// The file's tables by tag, each the bytes of an untransformed table, or null for a transformed one.
export function woff2Tables(file) {
  if (file.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  let at = 48;
  const base128 = () => {
    let value = 0;
    for (;;) {
      const byte = file[at++];
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
  };
  const entries = [];
  for (let count = file.readUInt16BE(12); count > 0; count -= 1) {
    const flags = file[at++];
    let tag = KNOWN[flags & 0x3f];
    if ((flags & 0x3f) === 0x3f) {
      tag = file.toString('latin1', at, at + 4);
      at += 4;
    }
    // glyf and loca are transformed at version 0 and not at 3; every other table at any version but 0.
    const transformed = ['glyf', 'loca'].includes(tag) ? flags >> 6 !== 3 : flags >> 6 !== 0;
    const length = base128();
    entries.push({ tag, transformed, length: transformed ? base128() : length });
  }
  const data = brotliDecompressSync(file.subarray(at, at + file.readUInt32BE(20)));
  const tables = new Map();
  let offset = 0;
  for (const { tag, transformed, length } of entries) {
    tables.set(tag, transformed ? null : data.subarray(offset, offset + length));
    offset += length;
  }
  if (offset !== data.length) throw new Error(`the tables take ${offset} bytes of the stream's ${data.length}`);
  return tables;
}

// The characters a cmap table maps, by its Unicode subtable of format 12, the one that reaches past the Basic
// Multilingual Plane (OpenType, cmap).
export function codePoints(cmap) {
  for (let record = 0; record < cmap.readUInt16BE(2); record += 1) {
    const table = cmap.readUInt32BE(4 + record * 8 + 4);
    if (cmap.readUInt16BE(table) !== 12) continue;
    const points = new Set();
    for (let group = 0; group < cmap.readUInt32BE(table + 12); group += 1) {
      const start = cmap.readUInt32BE(table + 16 + group * 12);
      const end = cmap.readUInt32BE(table + 20 + group * 12);
      for (let point = start; point <= end; point += 1) points.add(point);
    }
    return points;
  }
  throw new Error('no cmap subtable of format 12');
}
