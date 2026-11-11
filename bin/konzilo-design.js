#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { resolve, checkFormat, checkFingerprint, checkContrast, validateInputs, validateDesignFile, withFormat } from '../src/generator/index.js';
import { emitCss } from '../src/css/index.js';
import { componentsCss } from '../src/css/components.js';
import { backUp } from '../src/cli/backup.js';

const usage = 'Usage: konzilo-design resolve <file> | css <file> [-o out.css] | check <file> | components-css [-o out.css] | fonts <file> [-o folder] | logos <file> [-o folder] | tool <file> [--port N] [--no-open] | tool --status | tool --stop [<file>] | presentation <file> [-o out.zip] | design-md <file> [-o out.zip|out.md]';

// The package a site installs leaves the tool and the presentation out: they run from the design system's repository.
async function fromRepository(path, command) {
  const url = new URL(path, import.meta.url);
  if (!existsSync(url)) throw new Error(`This copy of the package has no "${command}" command. Run it from the design system's repository.`);
  return import(url);
}

try {
  const [command, path, ...args] = process.argv.slice(2);
  if (command === 'tool') {
    const values = [path, ...args].filter(v => v !== undefined);
    let designFile; let port; let open = true; let action = 'open';
    while (values.length) {
      const value = values.shift();
      if (value === '--no-open') open = false;
      else if (value === '--status' || value === '--stop') {
        if (action !== 'open') throw new Error(usage);
        action = value.slice(2);
      } else if (value === '--port') {
        const number = values.shift();
        if (!/^\d+$/.test(number || '') || Number(number) < 1 || Number(number) > 65535) throw new Error('Port must be an integer from 1 to 65535.');
        port = Number(number);
      } else if (value.startsWith('-') || designFile) throw new Error(usage);
      else designFile = value;
    }
    if (action === 'open' ? !designFile : port !== undefined || !open || (action === 'status' && designFile)) throw new Error(usage);
    const launcher = await fromRepository('../tool/launch.js', 'tool');
    if (action === 'status') {
      const running = await launcher.tools();
      const windows = (count) => `${count} window${count === 1 ? '' : 's'}`;
      process.stdout.write(running.length ? running.map((tool) => `${tool.url}  ${windows(tool.windows)}  ${tool.path}\n  since ${tool.started}, log ${tool.log}\n`).join('') : 'No design tool is running.\n');
    } else if (action === 'stop') {
      const stopped = await launcher.stop({ designFile });
      if (stopped.length) process.stdout.write(stopped.map((file) => `Stopped: ${file}\n`).join(''));
      else {
        process.stdout.write(designFile ? `No design tool has ${await launcher.canonical(designFile)} open.\n` : 'No design tool is running.\n');
        if (designFile) process.exitCode = 1;
      }
    } else {
      const tool = await launcher.launch({ designFile, port, open });
      const how = tool.joined ? 'The tool already had it open.' : tool.replaced ? 'The tool was started again, since its code has changed.' : `It stops ${launcher.IDLE / 1000} seconds after its last window closes, or with --stop.`;
      process.stdout.write(`Konzilo design tool: ${tool.url}\n${tool.created ? 'New design file' : 'Design file'}: ${tool.path}\n${how}\n`);
      if (!tool.opened) process.stderr.write(`No browser could be opened. Open ${tool.url} yourself.\n`);
    }
  } else if (command === 'presentation') {
    if (!path || !(args.length === 0 || (args.length === 2 && args[0] === '-o'))) throw new Error(usage);
    const { createPresentation } = await fromRepository('../tool/presentation.js', 'presentation');
    const report = await createPresentation(path, args[1]);
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else if (command === 'design-md') {
    if (!path || !(args.length === 0 || (args.length === 2 && args[0] === '-o'))) throw new Error(usage);
    const { writeDesignMd } = await fromRepository('../tool/design-md.js', 'design-md');
    process.stdout.write(`${await writeDesignMd(path, args[1])}\n`);
  } else if (command === 'fonts') {
    if (!path || !(args.length === 0 || (args.length === 2 && args[0] === '-o'))) throw new Error(usage);
    const { copyFonts } = await import('../src/konzilo/fonts.js');
    const { folder, families, files } = await copyFonts(path, args[1] ?? join(dirname(path), 'fonts'));
    process.stdout.write(families.length ? `${families.join(', ')}: ${files.length} font files in ${folder}.\n` : 'This design uses no typeface of the library, so there is nothing to copy.\n');
  } else if (command === 'logos') {
    if (!path || !(args.length === 0 || (args.length === 2 && args[0] === '-o'))) throw new Error(usage);
    const { writeLogos, DEFAULT_FOLDER } = await import('../src/konzilo/logos.js');
    const { folder, files } = await writeLogos(path, args[1] ?? DEFAULT_FOLDER);
    process.stdout.write(files.length ? `${files.join(', ')} in ${folder}.\n` : 'This design has no logo, so there is nothing to write.\n');
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
      const known = withFormat(file);
      validateInputs(file.inputs);
      const output = { ...known, resolved: await resolve(file.inputs) };
      validateDesignFile(output);
      await backUp(path);
      await writeFile(path, JSON.stringify(output, null, 2) + '\n');
    } else if (command === 'css') {
      const css = await emitCss(file);
      if (args.length) await writeFile(args[1], css);
      else process.stdout.write(css);
    } else {
      checkFormat(file);
      await checkFingerprint(file);
      validateDesignFile(file);
      checkContrast(file.resolved);
      process.stdout.write(`Format ${file.format}. Inputs fingerprint matches. Surface contrast check passed (${Object.keys(file.resolved.surfaces).length} kinds × 2 modes).\n`);
    }
  }
} catch (error) {
  process.stderr.write(`${error.code === 'ENOENT' ? `No such file: ${error.path}` : error.message}\n`);
  process.exitCode = 1;
}
