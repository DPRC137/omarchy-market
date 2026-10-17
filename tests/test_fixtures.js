const assert = require('node:assert/strict');
const M = require('./load_model')('MarketModel');
for (const input of [null, undefined, {}]) {
  assert.equal(M.normalizeBinanceTicker(input), null);
  assert.equal(M.normalizeCoinbaseTicker(input), null);
  assert.equal(M.normalizeYahooChart(input), null);
  assert.deepEqual(M.normalizeHyperliquidMeta(input), []);
  assert.deepEqual(M.normalizeYahooCandles(input), []);
}
assert.equal(M.normalizeBinanceTicker({ s: 'UNKNOWNUSDT', c: '1' }), null);
assert.equal(M.normalizeCoinbaseTicker({ type: 'heartbeat' }), null);
assert.equal(M.normalizeCoinbaseTicker({ product_id: 'BTC-USD', price: 'NaN' }), null);
assert.deepEqual(M.normalizeHyperliquidMeta([{ universe: [{ name: 'BTC' }] }, [{ markPx: 'NaN' }]], ['BTC']), []);
const candles = M.normalizeYahooCandles({ chart: { result: [{ timestamp: [1, 2, 3], indicators: { quote: [{ close: [null, 42, undefined] }] } }] } });
assert.equal(candles.length, 1);
assert.equal(candles[0].close, 42);
console.log('PASS malformed provider fixtures and missing candle filtering');
