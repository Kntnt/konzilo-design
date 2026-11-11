// A window's live line to the tool: a WebSocket, written out here since the server takes no dependencies.
// It brings each window the server's news, and its closing is how the server learns that a window has gone.
// A window sends nothing of its own, so only closing and pinging are read; the rest is passed over.
import { createHash } from 'node:crypto';
import { STATUS_CODES } from 'node:http';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const CLOSE = 8;
const PING = 9;
const PONG = 10;

function frame(opcode, payload = Buffer.alloc(0)) {
  const { length } = payload;
  let head;
  if (length < 126) head = Buffer.from([0x80 | opcode, length]);
  else if (length < 65536) head = Buffer.from([0x80 | opcode, 126, length >> 8, length & 255]);
  else {
    head = Buffer.alloc(10);
    head[0] = 0x80 | opcode;
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([head, payload]);
}

// Answers an upgrade the server will not take, and lets the socket go.
export function refuse(socket, status) {
  socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

// Takes an upgrade request the server has checked, and gives the open line: `send`, `close` and `onClose`.
export function acceptLive(req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  if (req.headers.upgrade?.toLowerCase() !== 'websocket' || !key) {
    refuse(socket, 400);
    return null;
  }
  const accept = createHash('sha1').update(key + GUID).digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
  socket.setTimeout(0);
  socket.setNoDelay(true);
  let buffer = head?.length ? Buffer.from(head) : Buffer.alloc(0);
  let open = true;
  const listeners = new Set();
  const closed = new Promise((done) => socket.once('close', done));
  closed.then(() => {
    open = false;
    for (const listener of listeners) listener();
  });
  socket.on('error', () => socket.destroy());
  const read = () => {
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 15;
      const masked = (buffer[1] & 128) !== 0;
      let length = buffer[1] & 127;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        length = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      // A window of the tool sends nothing this large.
      if (length > 65536) {
        socket.destroy();
        return;
      }
      const start = offset + (masked ? 4 : 0);
      if (buffer.length < start + length) return;
      let payload = buffer.subarray(start, start + length);
      if (masked) {
        const mask = buffer.subarray(offset, offset + 4);
        payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
      }
      buffer = buffer.subarray(start + length);
      if (opcode === CLOSE) {
        // Answered at once: Firefox otherwise holds the line open for seconds, and the window counts as open.
        if (open) socket.end(frame(CLOSE, payload.subarray(0, 2)));
        open = false;
        return;
      }
      if (opcode === PING && open) socket.write(frame(PONG, payload));
    }
  };
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    read();
  });
  read();
  return {
    send(message) {
      if (open) socket.write(frame(1, Buffer.from(JSON.stringify(message))));
    },
    // Says goodbye and waits a moment for the window to answer, which `closed` then shows.
    close(code = 1001) {
      if (open) {
        open = false;
        const reason = Buffer.alloc(2);
        reason.writeUInt16BE(code);
        socket.end(frame(CLOSE, reason));
      }
      const timer = setTimeout(() => socket.destroy(), 1000);
      timer.unref();
      return closed;
    },
    onClose(listener) {
      listeners.add(listener);
    },
  };
}
