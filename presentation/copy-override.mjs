// A design's own words: `<stem>.copy.json` beside its design file, over the English of copy.json. The
// presentation's build and the tool read it here alike. A key that has left copy.json is retired: a file written
// for an earlier version keeps it and still builds, and the key is ignored. A key that never was in copy.json
// stops both, since it is most likely a typo. A key removed from copy.json goes into retired-copy-keys.json.
import { readFile } from 'node:fs/promises';
import english from './copy.json' with { type: 'json' };
import retired from './retired-copy-keys.json' with { type: 'json' };

export const RETIRED_COPY_KEYS = new Set(retired);
export const copyOverridePath = (designFile) => `${designFile.replace(/\.[^/.]+$/, '')}.copy.json`;

// The words of the override that count, checked; none when there is no file. A message names the file and the key.
export async function readCopyOverride(designFile) {
  const path = copyOverridePath(designFile);
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  let custom;
  try {
    custom = JSON.parse(text);
  } catch (error) {
    throw new Error(`The copy file ${path} is not valid JSON: ${error.message}`);
  }
  if (!custom || Array.isArray(custom) || typeof custom !== 'object')
    throw new Error(`The copy file ${path} must hold one object of copy keys`);
  const words = {};
  for (const [key, value] of Object.entries(custom)) {
    if (!Object.hasOwn(english, key)) {
      if (RETIRED_COPY_KEYS.has(key)) continue;
      throw new Error(`Unknown copy key "${key}" in ${path}`);
    }
    if (typeof value !== 'string') throw new Error(`Copy key "${key}" in ${path} must be a string`);
    words[key] = value;
  }
  return words;
}

// Every word the document uses: the English, and over it the design's own where it has a copy file.
export const copyFor = async (designFile) => ({ ...english, ...(designFile ? await readCopyOverride(designFile) : {}) });
