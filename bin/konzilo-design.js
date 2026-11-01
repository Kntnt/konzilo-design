#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, checkFingerprint, checkContrast, validateInputs, validateDesignFile } from '../src/generator/index.js';
import { emitCss } from '../src/css/index.js';

const usage = 'Usage: konzilo-design resolve <file> | css <file> [-o out.css] | check <file>';

try {
  const [command, path, ...args] = process.argv.slice(2);
  if (!['resolve', 'css', 'check'].includes(command) || !path ||
      (command === 'css' ? !(args.length === 0 || (args.length === 2 && args[0] === '-o')) : args.length !== 0)) {
    throw new Error(usage);
  }
  const file = JSON.parse(await readFile(path, 'utf8'));
  if (command === 'resolve') {
    validateInputs(file.inputs);
    const output = { ...file, resolved: await resolve(file.inputs) };
    validateDesignFile(output);
    await writeFile(path, JSON.stringify(output, null, 2) + '\n');
  } else if (command === 'css') {
    const css = await emitCss(file);
    if (args.length) await writeFile(args[1], css);
    else process.stdout.write(css);
  } else {
    await checkFingerprint(file);
    validateDesignFile(file);
    checkContrast(file.resolved);
    process.stdout.write('Inputs fingerprint matches. Surface contrast check passed (8 kinds × 2 modes).\n');
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
