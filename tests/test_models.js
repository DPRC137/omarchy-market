// test_models.js - Deterministic tests for MarketModel

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load MarketModel.js by stripping .pragma library for Node environment
const code = fs.readFileSync(path.join(__dirname, '../models/MarketModel.js'), 'utf8')
  .replace('.pragma library', '');
const moduleFn = new Function(code + '; return { ASSET_DEFINITIONS, INSTRUMENT_TYPES, DEFAULT_ASSETS, FRESHNESS_THRESHOLDS, createEmptyQuote, getFreshness, normalizeBinanceTicker, normalizeCoinbaseTicker, normalizeHyperliquidMeta, calculateReferenceQuote, formatPrice, formatCompactPrice, formatPercentage, formatVolume };');
const M = moduleFn();

console.log("=== RUNNING DETERMINISTIC MARKET MODEL TESTS ===");

// Test 1: Binance Normalization
const btcBinanceRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/binance_btc.json'), 'utf8')).data;
const btcBinance = M.normalizeBinanceTicker(btcBinanceRaw, 1787262066020);
assert.strictEqual(btcBinance.asset, "BTC");
assert.strictEqual(btcBinance.instrument, "BTC_USD_SPOT");
assert.strictEqual(btcBinance.priceType, "SPOT_LAST");
assert.strictEqual(btcBinance.price, 72806.00);
assert.strictEqual(btcBinance.change24h, 4.742);
assert.strictEqual(btcBinance.high24h, 73110.70);
assert.strictEqual(btcBinance.low24h, 68902.22);
assert.strictEqual(btcBinance.bid, 72805.99);
assert.strictEqual(btcBinance.ask, 72806.00);
assert.strictEqual(btcBinance.freshness, "LIVE");
console.log("✓ Binance Normalization passed (Spot Instrument: BTC_USD_SPOT)");

// Test 2: Coinbase Normalization
const btcCoinbaseRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/coinbase_btc.json'), 'utf8'));
const btcCoinbase = M.normalizeCoinbaseTicker(btcCoinbaseRaw, 1787262066020);
assert.strictEqual(btcCoinbase.asset, "BTC");
assert.strictEqual(btcCoinbase.instrument, "BTC_USD_SPOT");
assert.strictEqual(btcCoinbase.priceType, "SPOT_LAST");
assert.strictEqual(btcCoinbase.price, 72794.99);
assert.strictEqual(btcCoinbase.high24h, 73100.00);
assert.strictEqual(btcCoinbase.low24h, 68900.00);
assert.ok(Math.abs(btcCoinbase.change24h - 4.786) < 0.01, `Change ${btcCoinbase.change24h} should be ~4.79%`);
console.log("✓ Coinbase Normalization passed (Spot Instrument: BTC_USD_SPOT)");

// Test 3: Hyperliquid Normalization
const hlRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/hyperliquid_meta.json'), 'utf8'));
const hlQuotes = M.normalizeHyperliquidMeta(hlRaw, ["BTC", "ETH", "SOL", "HYPE"], 1787262066020);
assert.strictEqual(hlQuotes.length, 4);
const hypeQuote = hlQuotes.find(q => q.asset === "HYPE");
assert.ok(hypeQuote, "HYPE quote should exist");
assert.strictEqual(hypeQuote.instrument, "HYPE_USD_PERP");
assert.strictEqual(hypeQuote.priceType, "PERP_MID");
assert.strictEqual(hypeQuote.price, 74.628);
assert.ok(Math.abs(hypeQuote.change24h - 2.666) < 0.01);
assert.strictEqual(hypeQuote.volume24h, 1273288450.96);
console.log("✓ Hyperliquid Normalization passed (Perp Instrument: HYPE_USD_PERP)");

// Test 4: Reference Price Calculation (Spot vs Perp isolation)
const quotesByProvider = {
  binance: btcBinance,
  coinbase: btcCoinbase
};
const spotReference = M.calculateReferenceQuote("BTC", quotesByProvider, 1787262066020);
assert.strictEqual(spotReference.asset, "BTC");
assert.strictEqual(spotReference.instrument, "BTC_USD_SPOT");
assert.ok(spotReference.price > 72700 && spotReference.price < 72900);
assert.strictEqual(spotReference.freshness, "LIVE");
console.log("✓ Reference Spot Price passed (BTC Avg: $" + spotReference.price.toFixed(2) + ")");

// Test 4b: HYPE routes to Hyperliquid native DEX feed
const hypeQuotes = { hyperliquid: hypeQuote };
const hypeRef = M.calculateReferenceQuote("HYPE", hypeQuotes, 1787262066020);
assert.strictEqual(hypeRef.asset, "HYPE");
assert.strictEqual(hypeRef.instrument, "HYPE_USD_PERP");
assert.strictEqual(hypeRef.price, 74.628);
console.log("✓ HYPE Reference Price routes to Hyperliquid DEX feed");

// Test 5: Freshness Transitions
const now = 1000000;
assert.strictEqual(M.getFreshness(now - 5000, now), "LIVE");
assert.strictEqual(M.getFreshness(now - 30000, now), "STALE");
assert.strictEqual(M.getFreshness(now - 90000, now), "OFFLINE");
assert.strictEqual(M.getFreshness(0, now), "OFFLINE");
console.log("✓ Freshness transitions passed");

// Test 6: Formatting Utilities
assert.strictEqual(M.formatPrice(72806.5), "$72,806.50");
assert.strictEqual(M.formatCompactPrice(72806.5), "$72.8K");
assert.strictEqual(M.formatCompactPrice(74.628), "$74.6");
assert.strictEqual(M.formatCompactPrice(2320.4), "$2.32K");
assert.strictEqual(M.formatPercentage(4.742), "+4.74%");
assert.strictEqual(M.formatPercentage(-2.31), "-2.31%");
assert.strictEqual(M.formatVolume(1273288450.96), "$1.27B");
assert.strictEqual(M.formatVolume(45000000), "$45.00M");
console.log("✓ Formatting helpers passed");

console.log("\nALL 6 TEST SUITES PASSED DETERMINISTICALLY! ✓\n");
