#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, checkFingerprint, checkContrast, validateInputs, validateDesignFile } from '../src/generator/index.js';
import { emitCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';

const usage = 'Usage: konzilo-design resolve <file> | css <file> [-o out.css] | check <file> | components-css [-o out.css] | tool [file] [--port N] [--no-open] | presentation <file> [-o out.zip]';

try {
  const [command, path, ...args] = process.argv.slice(2);
  if (command === 'tool') {
    const values = [path, ...args].filter(v => v !== undefined);
    let designFile; let port = 4174; let open = true;
    while (values.length) {
      const value = values.shift();
      if (value === '--no-open') open = false;
      else if (value === '--port') {
        const number = values.shift();
        if (!/^\d+$/.test(number || '') || Number(number) > 65535) throw new Error('Port must be an integer from 0 to 65535.');
        port = Number(number);
      } else if (value.startsWith('-') || designFile) throw new Error(usage);
      else designFile = value;
    }
    const { startTool } = await import('../tool/server.js');
    const tool = await startTool({ designFile, port, open });
    process.stdout.write(`Konzilo design tool: ${tool.url}\nDesign file: ${tool.path}\n`);
    const stop = async () => { await tool.close(); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  } else if (command === 'presentation') {
    if (!path || !(args.length === 0 || (args.length === 2 && args[0] === '-o'))) throw new Error(usage);
    const { createPresentation } = await import('../tool/presentation.js');
    const report = await createPresentation(path, args[1]);
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else if (command === 'components-css') {
    if (path !== undefined && (path !== '-o' || args.length !== 1)) throw new Error(usage);
    const css = await componentsCss();
    if (path) await writeFile(args[0], css);
    else process.stdout.write(css);
  } else {
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
      process.stdout.write(`Inputs fingerprint matches. Surface contrast check passed (${Object.keys(file.resolved.surfaces).length} kinds × 2 modes).\n`);
    }
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
