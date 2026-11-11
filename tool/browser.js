import { spawn } from 'node:child_process';

// Opens an address in the default browser. It answers whether the browser could be asked, not whether a window came up.
export function openBrowser(url) {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.once('error', () => done(false));
    child.once('exit', (code) => done(code === 0));
    child.unref();
  });
}
