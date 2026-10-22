const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const code = fs.readFileSync(`${__dirname}/../scripts/ws_bridge.js`, 'utf8');
function bridge(provider, initial) {
  const stdin = new EventEmitter(), stdout = new EventEmitter(), signals = new EventEmitter();
  const lines = [], sockets = [], timers = new Map();
  let timerId = 0, exited = false, blocked = false;
  stdout.write = s => { lines.push(JSON.parse(s)); return !blocked; };
  const input = new EventEmitter();
  class FakeSocket {
    static OPEN = 1;
    constructor(url, options) { assert.equal(options.maxPayload, 16384); assert.equal(options.perMessageDeflate, false); assert.equal(options.maxFragments,32); assert.equal(options.maxBufferedChunks,64); assert.equal(options.maxHeaderSize,8192); assert.equal(options.followRedirects,false); this.url = url; this.readyState = 1; this.sent = []; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close() { this.closed = true; }
    terminate() { this.closed = true; }
    on() {}
  }
  const context = vm.createContext({
    console, Buffer,
    require: name => { if (name === '../third_party/ws/lib/websocket') return FakeSocket; if (name === './ws_protocol') return require('../scripts/ws_protocol'); assert.equal(name, 'readline'); return { createInterface: () => input }; },
    process: { env: {}, argv: ['node', 'bridge', provider, initial], stdin, stdout, on: signals.on.bind(signals), exit: () => { exited = true; } },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, setInterval: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id)
  });
  vm.runInContext(code, context);
  return { lines, sockets, timers, stdin, signals, blockOutput: () => { blocked = true; }, reconnect: () => input.emit('line', '{"action":"reconnect"}'), command: symbols => input.emit('line', JSON.stringify({ action: 'set_subscriptions', symbols })), get exited() { return exited; } };
}
for (const provider of ['binance', 'coinbase']) {
  const b = bridge(provider, 'BTC,ETH');
  assert.equal(b.sockets.length, 1);
  b.sockets[0].onopen();
  b.command(['ETH', 'SOL', 'ETH', 'BAD/URL']);
  const current = b.lines.filter(m => m.type === 'subscriptions').at(-1);
  assert.deepEqual(Array.from(current.symbols), ['ETH', 'SOL']);
  const operations = b.sockets[0].sent;
  if (provider === 'binance') {
    assert.ok(operations.some(m => m.method === 'UNSUBSCRIBE' && m.params[0] === 'btcusdt@ticker'));
    assert.ok(operations.some(m => m.method === 'SUBSCRIBE' && m.params[0] === 'solusdt@ticker'));
  } else {
    assert.ok(operations.some(m => m.type === 'unsubscribe' && m.product_ids[0] === 'BTC-USD'));
    assert.ok(operations.some(m => m.type === 'subscribe' && m.product_ids[0] === 'SOL-USD'));
  }
  const sent = operations.length;
  b.command(['ETH', 'SOL']); assert.equal(operations.length, sent);
  b.command([]); assert.equal(b.sockets[0].closed, true); assert.equal(b.timers.size, 0);
  b.command(['BTC']); assert.equal(b.sockets.length, 2);
  b.sockets[1].onopen();
  b.sockets[1].onerror(new Error('lost'));
  assert.equal(b.sockets[1].closed, true);
  assert.equal(b.timers.size, 1); // One reconnect; no leaked old socket/watchdog.
  b.stdin.emit('end');
  assert.equal(b.exited, true); assert.equal(b.timers.size, 0);
  const slow = bridge(provider, 'BTC'); slow.sockets[0].onopen(); slow.blockOutput();
  const tick = provider === 'binance' ? {data:{s:'BTCUSDT',c:'1'}} : {type:'ticker',product_id:'BTC-USD',price:'1'};
  slow.sockets[0].onmessage({data:JSON.stringify(tick)});
  assert.equal(slow.exited,true); assert.equal(slow.sockets[0].closed,true); assert.equal(slow.timers.size,0);
  const many = bridge(provider, Array.from({length:100},(_,i)=>'A'+i).join(','));
  assert.equal(many.lines.find(m=>m.type==='subscriptions').symbols.length,20); many.stdin.emit('end');
  const empty = bridge(provider, ''); assert.equal(empty.sockets.length, 0);
  empty.reconnect(); assert.equal(empty.sockets.length, 0);
  const stalled = bridge(provider, 'BTC');
  assert.equal(stalled.timers.size, 1); // Deadline exists even before onopen.
  [...stalled.timers.values()][0]();
  assert.equal(stalled.sockets[0].closed, true);
  assert.equal(stalled.sockets[0].onclose, null); // No close-event dependency.
  assert.equal(stalled.lines.at(-1).status, 'RECONNECTING');
  stalled.reconnect();
  assert.equal(stalled.sockets.length, 2);
  assert.equal(stalled.timers.size, 1);
  stalled.sockets[1].onopen();
  stalled.command(['ETH']);
  stalled.reconnect();
  assert.equal(stalled.sockets[1].closed, true);
  assert.equal(stalled.sockets.length, 3);
  stalled.sockets[2].onopen();
  if (provider === 'coinbase') assert.deepEqual(Array.from(stalled.sockets[2].sent[0].product_ids), ['ETH-USD']);
  else assert.ok(stalled.sockets[2].url.includes('ethusdt@ticker'));
  [...stalled.timers.values()][0](); // Open socket goes silent and close emits nothing.
  assert.equal(stalled.sockets[2].closed, true);
  assert.equal(stalled.lines.at(-1).status, 'RECONNECTING');
  stalled.stdin.emit('end'); assert.equal(stalled.timers.size, 0);
}
console.log('PASS actual bridge IPC, duplicate subscription suppression, empty subscriptions, reconnect cleanup and parent EOF');
