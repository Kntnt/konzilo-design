import { spawn } from 'node:child_process';

// Opens an address in the default browser. It answers whether the browser could be asked, not whether a window came up.
// The command keeps this process alive until it answers, since a launch may have nothing else to wait for; one still
// busy after a few seconds, as xdg-open can be while a browser starts, has been asked and is let go.
export function openBrowser(url, { within = 5000 } = {}) {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  return new Promise((done) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    const waited = setTimeout(() => {
      child.unref();
      done(true);
    }, within);
    const answer = (asked) => {
      clearTimeout(waited);
      done(asked);
    };
    child.once('error', () => answer(false));
    child.once('exit', (code) => answer(code === 0));
  });
}
