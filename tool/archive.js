import { deflateRawSync } from 'node:zlib';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// UTF-8 names, raw DEFLATE and ordinary ZIP headers, without ZIP64, so every entry and the whole stay below 4 GB.
// `comment` goes in the archive's end record, where a writer can find its own mark again without unpacking anything.
export function zipFiles(entries, { date = new Date(), comment = '' } = {}) {
  const time = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1);
  const day = ((Math.max(1980, date.getUTCFullYear()) - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, content } of entries) {
    const filename = Buffer.from(name, 'utf8');
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const compressed = deflateRawSync(bytes, { level: 9 });
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc32(bytes), 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    local.copy(central, 6, 4, 30);
    central.writeUInt32LE(offset, 42);
    locals.push(local, filename, compressed);
    centrals.push(central, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const note = Buffer.from(comment, 'utf8');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(note.length, 20);
  return Buffer.concat([...locals, directory, end, note]);
}

// One entry, as the presentation is written.
export const zipFile = (name, content, date = new Date()) => zipFiles([{ name, content }], { date });
