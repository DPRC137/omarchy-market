const assert = require('node:assert/strict');
const fs = require('node:fs');
const H = require('./load_model')('History');
const captured = JSON.parse(fs.readFileSync(`${__dirname}/fixtures/yahoo_tsla_closed_session.json`, 'utf8'));
const saturday = Date.parse('2026-10-17T20:05:00Z');
const request = H.specification('TSLA', 'yahoo', '1D', saturday);
// Regression from the production screenshot: the last session is over 24h old.
assert.equal(H.normalize(captured, request).length, 79, 'weekend 1D discarded the last regular session');
assert.match(request.url, /range=1d/);
assert.ok(!request.url.includes('period1='));
assert.equal(request.sessionDate, '2026-10-16');
assert.equal(request.windowLabel, 'Latest regular session');
for (const date of ['2026-10-19T12:00:00Z', '2026-10-20T12:00:00Z']) {
  assert.equal(H.normalize(captured, H.specification('TSLA', 'yahoo', '1D', Date.parse(date))).length, 79, 'pre-open/holiday should retain the last supplied session without guessing exchange dates');
}
const fixture = (sessions, points, extraMeta = {}) => ({ chart: { result: [{ meta: { symbol: 'TSLA', currency: 'USD', dataGranularity: '5m', gmtoffset: -14400, ...extraMeta }, tradingPeriods: sessions, timestamp: points.map(p => p[0]), indicators: { quote: [{ close: points.map(p => p[1]) }] } }] } });
const friday = { start: 1792157400, end: 1792180800, gmtoffset: -14400 };
const thursday = { start: friday.start - 86400, end: friday.end - 86400, gmtoffset: -14400 };
const monday = { start: friday.start + 3 * 86400, end: friday.end + 3 * 86400, gmtoffset: -14400 };
const several = fixture([[thursday], [friday], [monday]], [[thursday.start, 1], [friday.start, 2], [friday.end, 3], [monday.start, null]]);
let r = H.specification('TSLA', 'yahoo', '1D', monday.start * 1000 + 1000);
assert.deepEqual(H.normalize(several, r).map(p => p.close), [2, 3]);
assert.equal(r.sessionDate, '2026-10-16');
// Yahoo commonly omits tradingPeriods while currentTradingPeriod has already
// advanced to the upcoming session. That metadata must not discard Friday.
const upcoming = fixture(undefined, [[thursday.start, 1], [friday.start, 2], [friday.end, 3]], { currentTradingPeriod: { regular: monday } });
r = H.specification('TSLA', 'yahoo', '1D', monday.start * 1000 - 1000);
assert.deepEqual(H.normalize(upcoming, r).map(p => p.close), [2, 3]);
assert.equal(r.sessionDate, '2026-10-16');
r = H.specification('TSLA', 'yahoo', '1D', monday.start * 1000 - 1000);
r.httpRange = '5d';
assert.deepEqual(H.normalize(upcoming, r).map(p => p.close), [2, 3]);
// The first real candle in a new session is data, not an unavailable chart.
several.chart.result[0].indicators.quote[0].close[3] = 4;
r = H.specification('TSLA', 'yahoo', '1D', monday.start * 1000 + 1000);
assert.deepEqual(H.normalize(several, r).map(p => p.close), [4]);
assert.equal(r.sessionDate, '2026-10-19');
// Provider session boundaries, including half days and nested regular arrays.
const halfDay = { start: friday.start, end: friday.start + 3.5 * 3600, gmtoffset: -14400 };
const half = fixture({ regular: [[halfDay]] }, [[halfDay.start - 300, 99], [halfDay.start, 2], [halfDay.end, 3], [halfDay.end + 300, 100]]);
assert.deepEqual(H.normalize(half, H.specification('TSLA', 'yahoo', '1D', saturday)).map(p => p.close), [2, 3]);
for (const offset of [19800, 36000, -18000]) {
  const local = fixture([[{ ...friday, gmtoffset: offset }]], [[friday.start, 2], [friday.end, 3]], { gmtoffset: offset });
  assert.equal(H.normalize(local, H.specification('TSLA', 'yahoo', '1D', saturday)).length, 2);
}
const wrongInterval = structuredClone(captured);
wrongInterval.chart.result[0].meta.dataGranularity = '1h';
assert.throws(() => H.normalize(wrongInterval, H.specification('TSLA', 'yahoo', '1D', saturday)), /interval/i);
// Recovery is bounded and retains the original source, generation and interval.
const jobs = [];
const history = H.create({ cancel() {}, enqueue(req, callback) { jobs.push({ req, callback }); } }, () => {}, () => saturday);
history.select('TSLA', 'yahoo', '1D', 'USD');
const empty = JSON.parse(fs.readFileSync(`${__dirname}/fixtures/yahoo_tsla_empty_window.json`, "utf8"));
jobs[0].callback({ data: empty }, jobs[0].req);
assert.equal(jobs.length, 2);
assert.match(jobs[1].req.url, /range=5d/);
assert.equal(jobs[1].req.generation, jobs[0].req.generation);
assert.equal(jobs[1].req.provider, 'yahoo');
// A delayed primary response cannot replace the recovery attempt.
jobs[0].callback({ data: captured }, jobs[0].req);
assert.equal(history.entry(), undefined);
jobs[1].callback({ data: captured }, jobs[1].req);
assert.equal(history.state, 'ready');
assert.equal(history.entry().points.length, 79);
assert.equal(history.entry().sessionDate, '2026-10-16');
history.select('TSLA', 'yahoo', '1D', 'USD', true);
jobs.at(-1).callback({ data: empty }, jobs.at(-1).req);
jobs.at(-1).callback({ data: empty }, jobs.at(-1).req);
assert.equal(history.state, 'stale'); // Last good session remains visible.
assert.equal(jobs.length, 4); // No unbounded repeated empty-window retries.
assert.equal(history.entry().points.length, 79);
const lone = fixture([[monday]], [[monday.start, 4]]);
history.select('TSLA', 'yahoo', '1D', 'USD', true);
jobs.at(-1).callback({ data: lone }, jobs.at(-1).req); // Future point relative to Saturday rejected.
assert.equal(history.state, 'loading');
const opened = H.create({ cancel() {}, enqueue(req, cb) { cb({ data: lone }, req); } }, () => {}, () => monday.start * 1000 + 1000);
opened.select('TSLA', 'yahoo', '1D', 'USD');
assert.equal(opened.state, 'ready');
assert.equal(opened.entry().points.length, 1);
console.log('PASS production equity sessions: captured weekend failure, pre-open/holiday, provider boundaries, half days, interval validation, bounded recovery, late replies, stale cache and first candle');
