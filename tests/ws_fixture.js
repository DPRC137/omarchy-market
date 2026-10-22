'use strict';
const http = require('node:http');
const { createHash } = require('node:crypto');
function header(length, opcode = 1, fin = true) {
  const bytes = length < 126 ? 2 : length <= 65535 ? 4 : 10;
  const b = Buffer.alloc(bytes); b[0] = (fin ? 128 : 0) | opcode;
  b[1] = length < 126 ? length : bytes === 4 ? 126 : 127;
  if (bytes === 4) b.writeUInt16BE(length, 2);
  if (bytes === 10) b.writeBigUInt64BE(BigInt(length), 2);
  return b;
}
function frame(data, opcode = 1, fin = true) {
  const b = Buffer.from(data); return Buffer.concat([header(b.length, opcode, fin), b]);
}
function peer(onConnect) {
  const sockets = new Set();
  const server = http.createServer();
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('upgrade', (request, socket) => {
    const accept = createHash('sha1').update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
    socket.on('error', () => {});
    socket.on('data', () => {}); // Drain masked client control/subscription frames.
    socket.on('end', () => socket.end()); // Upgrade sockets allow half-open TCP.
    onConnect(socket, request);
  });
  return {
    sockets,
    listen: () => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('ws://127.0.0.1:'+server.address().port))),
    close: () => { for (const s of sockets) s.destroy(); return new Promise(resolve => server.close(resolve)); }
  };
}
function ticker(provider, extra = '') {
  return JSON.stringify(provider === 'binance'
    ? { stream: 'btcusdt@ticker', data: { s: 'BTCUSDT', c: '321.12', P: '2.5', h: '330', l: '310', q: '1000', E: 1792641600000, unused: extra } }
    : { type: 'ticker', product_id: 'BTC-USD', price: '321.12', open_24h: '310', high_24h: '330', low_24h: '300', volume_24h: '200', time: '2026-10-22T04:00:00Z', unused: extra });
}
module.exports = { header, frame, peer, ticker };
