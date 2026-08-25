// test_fixtures.js - Deterministic resilience tests with edge cases & malformed payloads

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, '../models/MarketModel.js'), 'utf8').replace('.pragma library', '');
const moduleFn = new Function(code + '; return { normalizeBinanceTicker, normalizeCoinbaseTicker, normalizeHyperliquidMeta, normalizeYahooChart, normalizeYahooCandles, calculateReferenceQuote, createEmptyQuote, getFreshness };');
const M = moduleFn();

console.log("=== RUNNING FIXTURE RESILIENCE & EDGE-CASE TESTS ===");

// 1. Null / Undefined / Empty payloads
assert.strictEqual(M.normalizeBinanceTicker(null), null);
assert.strictEqual(M.normalizeBinanceTicker({}), null);
assert.strictEqual(M.normalizeCoinbaseTicker(null), null);
assert.strictEqual(M.normalizeCoinbaseTicker({ type: "heartbeat" }), null);
assert.deepStrictEqual(M.normalizeHyperliquidMeta(null), []);
assert.deepStrictEqual(M.normalizeHyperliquidMeta([]), []);
assert.strictEqual(M.normalizeYahooChart(null), null);
assert.strictEqual(M.normalizeYahooChart({}), null);
assert.strictEqual(M.normalizeYahooChart({ chart: {} }), null);
assert.strictEqual(M.normalizeYahooChart({ chart: { result: [] } }), null);
assert.deepStrictEqual(M.normalizeYahooCandles(null), []);
assert.deepStrictEqual(M.normalizeYahooCandles({}), []);
console.log("✓ Null/undefined payload safety verified");

// 2. Unknown symbol handling
const binanceUnknown = M.normalizeBinanceTicker({ s: "UNKNOWNUSDT", c: "123.45" });
assert.strictEqual(binanceUnknown, null);
const cbUnknown = M.normalizeCoinbaseTicker({ type: "ticker", product_id: "UNKNOWN-USD", price: "0.15" });
assert.strictEqual(cbUnknown, null);
const yahooUnknown = M.normalizeYahooChart({ chart: { result: [{ meta: { symbol: "NONEXISTENT_STOCK" } }] } });
assert.strictEqual(yahooUnknown, null);
console.log("✓ Unknown symbol filtering verified");

// 3. Malformed/NaN number handling
const binanceNaN = M.normalizeBinanceTicker({ s: "BTCUSDT", c: "not-a-number", P: "invalid" });
assert.strictEqual(binanceNaN.asset, "BTC");
assert.strictEqual(binanceNaN.price, 0);
assert.strictEqual(binanceNaN.change24h, 0);

const yahooNaN = M.normalizeYahooChart({
  chart: {
    result: [{
      meta: { symbol: "AAPL", regularMarketPrice: "not-a-number" },
      timestamp: [1000],
      indicators: { quote: [{ close: ["invalid"] }] }
    }]
  }
});
assert.strictEqual(yahooNaN, null);
console.log("✓ Malformed/NaN number recovery verified");

// 4. Missing fields in Hyperliquid payload
const hlPartial = [
  { universe: [{ name: "BTC" }, { name: "ETH" }] },
  [{ markPx: "70000" }] // ETH missing ctx
];
const hlRes = M.normalizeHyperliquidMeta(hlPartial, ["BTC", "ETH"]);
assert.strictEqual(hlRes.length, 1);
assert.strictEqual(hlRes[0].asset, "BTC");
console.log("✓ Partial provider payload recovery verified");

// 5. Yahoo Error payload handling
const yahooErrorPayload = {
  chart: {
    error: {
      code: "Unauthorized",
      description: "Invalid Crumb"
    }
  }
};
assert.strictEqual(M.normalizeYahooChart(yahooErrorPayload), null);
assert.deepStrictEqual(M.normalizeYahooCandles(yahooErrorPayload), []);
console.log("✓ Yahoo error payload resilience verified");

// 6. Provider Isolation during Aggregation (One provider offline)
const now = 2000000;
const liveBinance = {
  asset: "BTC", instrument: "BTC_USD_SPOT", price: 72000, change24h: 3.5, volume24h: 1e9,
  high24h: 73000, low24h: 70000, bid: 71999, ask: 72001, spread: 2,
  receivedTimestamp: now - 2000, freshness: "LIVE"
};
const deadCoinbase = {
  asset: "BTC", instrument: "BTC_USD_SPOT", price: 60000, change24h: -10, volume24h: 5e8,
  high24h: 65000, low24h: 58000, bid: 59999, ask: 60001, spread: 2,
  receivedTimestamp: now - 120000, freshness: "OFFLINE" // 2 minutes old
};

const quotes = { binance: liveBinance, coinbase: deadCoinbase };
const ref = M.calculateReferenceQuote("BTC", quotes, now);
assert.strictEqual(ref.price, 72000, "Dead Coinbase price should be excluded from reference calculation");
assert.strictEqual(ref.freshness, "LIVE");
console.log("✓ Stale/offline provider isolation verified");

console.log("\nALL FIXTURE & RESILIENCE TESTS PASSED! ✓\n");
