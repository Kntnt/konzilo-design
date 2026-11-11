// The server `design-tool` starts apart from itself: one design file, until no window has had it open for a
// while, until `design-tool --stop`, or until a signal. Its output goes to the log `design-tool --status` names.
// Started only by tool/launch.js: node tool/serve.js <design-file> --port N --runtime <folder> --idle <ms> [--backed-up]
import { randomBytes } from 'node:crypto';
import { startTool } from './server.js';
import { codeFingerprint, logPath, removeRecord, writeRecord } from './launch.js';

const [designFile, ...rest] = process.argv.slice(2);
const option = (name) => rest[rest.indexOf(name) + 1];
const port = Number(option('--port'));
const runtime = option('--runtime');
const idle = Number(option('--idle'));
const log = (text) => process.stdout.write(`${new Date().toISOString()} ${text}\n`);

// Taken before the build, so a change made while it runs counts as newer than this server.
const code = await codeFingerprint();
const stopKey = randomBytes(24).toString('hex');
let tool = null;
let ending = null;
const end = (reason) =>
  (ending ??= (async () => {
    log(`Stopping: ${reason}.`);
    await removeRecord(runtime, port).catch(() => {});
    try {
      await tool?.close();
    } catch (error) {
      log(`While stopping: ${error.message}`);
    }
    log('Stopped.');
    process.exit(0);
  })());
process.on('SIGTERM', () => end('a signal'));
process.on('SIGINT', () => end('a signal'));
process.on('SIGHUP', () => end('a signal'));
try {
  tool = await startTool({
    designFile,
    port,
    open: false,
    idle,
    onIdle: () => end(`no window for ${idle / 1000} seconds`),
    stopKey,
    onStop: () => end('asked to by design-tool'),
    backedUp: rest.includes('--backed-up'),
    code,
  });
  await writeRecord(runtime, port, { pid: process.pid, port, path: tool.path, key: stopKey, log: logPath(runtime, port), started: new Date().toISOString() });
  log(`${tool.created ? 'Created' : 'Opened'} ${tool.path} at ${tool.url}.`);
  process.send?.({ ready: true, url: tool.url, created: tool.created });
} catch (error) {
  log(error.stack || error.message);
  process.exitCode = 1;
  if (process.send) process.send({ error: error.message, code: error.code }, () => process.disconnect());
}
