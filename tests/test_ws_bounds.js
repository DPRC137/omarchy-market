'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { once } = require('node:events');
const Protocol = require('../scripts/ws_protocol');
const { peer, header, frame, ticker } = require('./ws_fixture');
const bridgePath = path.resolve(__dirname, '../scripts/ws_bridge.js');
const preload = path.resolve(__dirname, 'fixtures/ws_loopback.cjs');
function start(provider, url) {
  const child = spawn(process.execPath, ['--require', preload, bridgePath, provider, 'BTC'], { env: { ...process.env, MARKET_WS_TEST_URL: url } });
  const records = [], errors = []; let partial = ''; let done = false;
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    partial += chunk;
    for (;;) {
      const end = partial.indexOf('\n'); if (end < 0) break;
      const line = partial.slice(0, end); partial = partial.slice(end + 1);
      assert.ok(Buffer.byteLength(line+'\n') <= Protocol.MAX_LINE_BYTES, 'unbounded helper record');
      records.push(JSON.parse(line));
    }
  });
  child.stderr.on('data', data => errors.push(data.toString()));
  const exited = once(child, 'close').then(([code]) => { done = true; return code; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 12000);
  async function wait(predicate) {
    const end = Date.now() + 7000;
    while (!predicate()) {
      assert.ok(!done && Date.now() < end, 'bridge stopped/timed out: '+errors.join(''));
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  return { child, records, wait, async stop() { if (child.exitCode === null) child.stdin.end(); const code = await exited; clearTimeout(timer); assert.equal(code, 0, errors.join('')); } };
}
async function valid(provider) {
  const unused = 'x'.repeat(8000);
  const server = peer(socket => {
    // Normal fragmented UTF-8 JSON plus a large, unused nested extension.
    const payload = Buffer.from(ticker(provider, unused));
    socket.write(frame(payload.subarray(0, 100), 1, false));
    socket.write(frame('ping', 9));
    socket.write(frame(payload.subarray(100), 0));
  });
  const b = start(provider, await server.listen());
  try {
    await b.wait(() => b.records.some(r => r.type === 'ticker'));
    const msg = b.records.find(r => r.type === 'ticker');
    assert.equal(msg.raw.unused, undefined);
    assert.equal(msg.raw[provider === 'binance' ? 'c' : 'price'], '321.12');
    assert.ok(JSON.stringify(msg).length < 600, 'projected ticker not compact');
    assert.deepEqual(Object.keys(msg.raw).sort(), Object.keys(Protocol.ticker(provider, JSON.parse(ticker(provider)).data || JSON.parse(ticker(provider)), ['BTC']).raw).sort());
  } finally { await b.stop(); await server.close(); }
}
async function slowOutput() {
  const batch = Buffer.concat(Array.from({length:128},()=>frame(ticker('binance'))));
  const server = peer(socket => {
    function flood() { if (socket.destroyed) return; if (socket.write(batch)) setImmediate(flood); else socket.once('drain',flood); }
    flood();
  });
  const b = start('binance', await server.listen());
  b.child.stdout.pause();
  try { const [code] = await once(b.child,'exit'); assert.equal(code,0,'stdout backpressure did not stop helper cleanly'); }
  finally { b.child.stdout.resume(); await b.stop(); await server.close(); }
  console.log('PASS stopped stdout reader: helper exits instead of queuing messages');
}
async function attack(name, send) {
  let connections = 0, rejected = false;
  const server = peer(socket => {
    connections++;
    if (connections === 1) {
      socket.on('close', () => { rejected = true; });
      send(socket);
    } else socket.write(frame(ticker('binance')));
  });
  const b = start('binance', await server.listen());
  try {
    await b.wait(() => b.records.some(r => r.type === 'ticker'));
    assert.equal(rejected, true, name+': peer not disconnected');
    assert.ok(b.records.some(r => r.status === 'RECONNECTING'));
    assert.equal(b.records.filter(r => r.type === 'ticker').length, 1, name+': attack reached stdout');
    console.log('PASS WS attack/recovery:', name);
  } finally { await b.stop(); await server.close(); }
}
(async () => {
  const vendor = path.resolve(__dirname, '../third_party/ws');
  const upstream = JSON.parse(fs.readFileSync(path.join(vendor,'UPSTREAM.json'),'utf8'));
  for (const [file, sha] of Object.entries(upstream.files)) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(vendor,file))).digest('hex'),sha,'modified bundled ws source: '+file);
  await valid('binance'); await valid('coinbase'); await slowOutput();
  await attack('2 MiB valid ticker with unused field', socket => {
    const payload = Buffer.from(ticker('binance', 'x'.repeat(2*1024*1024)));
    socket.write(header(payload.length));
    let sent = 0;
    const timer = setInterval(() => { if (sent < payload.length) { socket.write(payload.subarray(sent, sent+1024)); sent += 1024; } else clearInterval(timer); }, 5);
    socket.on('close', () => { clearInterval(timer); assert.ok(sent < payload.length, 'full oversized message downloaded'); });
  });
  await attack('2^40-byte advertised frame header without body', socket => socket.write(header(2**40)));
  await attack('fragment aggregate overflow before final payload', socket => {
    socket.write(frame('x'.repeat(8192), 1, false)); socket.write(frame('x'.repeat(8192), 0, false)); socket.write(header(1, 0));
  });
  await attack('too many fragments', socket => { for (let i=0;i<34;i++) socket.write(frame('x', i ? 0 : 1, false)); });
  await attack('invalid UTF-8', socket => socket.write(frame(Buffer.from([0xc0, 0xaf]))));
  await attack('unsolicited compressed frame', socket => socket.write(Buffer.from([0xc1, 1, 0])));
  await attack('binary ticker', socket => socket.write(frame(ticker('binance'), 2)));
  const msg = Protocol.ticker('binance', { s:'BTCUSDT', c:'1', h:'9'.repeat(1000), junk:'z'.repeat(50000) }, ['BTC']);
  assert.deepEqual(msg.raw, { s:'BTCUSDT', c:'1' });
  assert.equal(Protocol.ticker('binance', {s:'ETHUSDT',c:'1'},['BTC']), null);
  console.log('PASS bounded production WebSocket frames, fragmentation, projection, reconnect and parent EOF');
})().catch(error => { console.error(error); process.exitCode = 1; });
