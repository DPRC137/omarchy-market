const assert = require('node:assert/strict');
const H = require('./load_model')('History');
const Q = require('./load_model')('RequestQueue');
let now = 1800000000000;
const jobs = [];
const q = Q.create((request, done) => {
  const job = { request, done, aborted: false }; jobs.push(job);
  return () => { job.aborted = true; };
}, () => now, 0, 4);
let revisions = 0;
const h = H.create(q, () => revisions++, () => now);
const bars = (job, values = [100, 102]) => values.map((price, i) => [job.request.from + 600000 * (i + 1), '1', '2', '0', String(price)]);
h.select('BTC', 'binance', '1D', 'USDT');
const first = jobs[0];
h.select('ETH', 'binance', '1W', 'USDT');
assert.equal(first.aborted, true);
h.select('AAPL', 'yahoo', '1M', 'USD');
const stock = jobs[2];
assert.equal(h.state, 'loading');
first.done({ data: bars(first) });
assert.equal(h.entry(), undefined);
assert.equal(h.state, 'loading');
stock.done({ data: { chart: { result: [{ meta: { symbol: 'AAPL', currency: 'USD' }, timestamp: [(now - 3600000) / 1000, (now - 1000000) / 1000], indicators: { quote: [{ close: [200, 201] }] } }] } } });
assert.equal(h.state, 'ready');
assert.equal(h.entry().points[0].close, 200);
const before = jobs.length;
h.select('AAPL', 'yahoo', '1M', 'USD'); assert.equal(jobs.length, before);
now += h.ttl + 1; h.expire(); assert.equal(h.state, 'stale');
h.select('AAPL', 'yahoo', '1M', 'USD'); assert.equal(jobs.length, before + 1);
jobs.at(-1).done({ error: 'HTTP 503' });
assert.equal(h.state, 'stale'); assert.equal(h.entry().points.length, 2);
h.select('AAPL', 'yahoo', '1M', 'USD', true);
assert.equal(h.state, 'loading'); assert.equal(jobs.length, before + 2);
h.select('BTC', 'binance', '1D', 'USDT');
const refreshed = jobs.at(-1);
refreshed.done({ data: bars(refreshed, [5, 8]) });
assert.equal(h.entry().points.at(-1).close, 8);
h.select('BTC', 'binance', '1D', 'USDT', true);
const old = jobs.at(-1);
h.select('BTC', 'binance', '1D', 'USDT', true);
const newer = jobs.at(-1);
newer.done({ data: bars(newer, [5, 10]) });
old.done({ data: bars(old, [5, 999]) });
assert.equal(h.entry().points.at(-1).close, 10);
// Validate callback identity rather than only whichever view happens to be open.
let receive, identity;
const direct = H.create({ cancel() {}, enqueue(r, cb) { receive = cb; identity = r; } }, () => {}, () => now);
direct.select('BTC', 'binance', '1D', 'USDT');
for (const mutation of [{ provider: 'hyperliquid' }, { asset: 'ETH' }, { generation: -1 }, { interval: '1w' }, { instrument: 'ETHUSDT' }]) {
  receive({ data: bars({ request: identity }) }, { ...identity, ...mutation });
  assert.equal(direct.entry(), undefined);
}
receive({ data: bars({ request: identity }) }, identity);
assert.equal(direct.state, 'ready');
for (const range of H.RANGES) {
  const b = H.specification('BTC', 'binance', range, now);
  const y = H.specification('AAPL', 'yahoo', range, now);
  if (range === "1D") { assert.equal(y.window, "session"); assert.equal(y.from, null); }
  else assert.equal(b.from, y.from);
  assert.equal(b.to, y.to);
  assert.ok(!b.url.includes('hyperliquid'));
}
assert.throws(() => H.normalize([{ s: 'BTC', i: '1h', t: now - 1000, c: '1' }], H.specification('HYPE', 'hyperliquid', '1D', now)), /Unexpected/);
const ys = H.specification('AAPL', 'yahoo', '1D', now);
assert.throws(() => H.normalize({ chart: { result: [{ meta: { symbol: 'MSFT', currency: 'USD' } }] } }, ys), /Unexpected/);
assert.deepEqual(H.normalize([[now - 1000, 0, 0, 0, null]], H.specification('BTC', 'binance', '1D', now)), []);
// Empty/error yields explicit unavailable and permits retry, without synthetic points.
h.select('ETH', 'binance', '1Y', 'USDT'); jobs.at(-1).done({ data: [] });
assert.equal(h.state, 'unavailable'); assert.equal(h.entry(), undefined);
h.select('ETH', 'binance', '1Y', 'USDT', true); jobs.at(-1).done({ data: bars(jobs.at(-1)) });
assert.equal(h.state, 'ready');
h.maxEntries = 2;
for (const asset of ['SOL', 'DOGE', 'ADA']) { h.select(asset, 'binance', '1D', 'USDT'); jobs.at(-1).done({ data: bars(jobs.at(-1)) }); }
assert.ok(Object.keys(h.cache).length <= 2);
h.clear(); assert.equal(q.hasWork(), false);
assert.ok(revisions > 10);
console.log('PASS production history: rapid switching, source/request identity, out-of-order replies, cache expiry, force refresh, stale errors, retry, consistent ranges and bounded eviction');
