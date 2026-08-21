// test_models.js - Deterministic tests for MarketModel & Dynamic Watchlist

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load MarketModel.js by stripping .pragma library for Node environment
const code = fs.readFileSync(path.join(__dirname, '../models/MarketModel.js'), 'utf8')
  .replace('.pragma library', '');
const moduleFn = new Function(code + '; return { SCHEMA_VERSION, MAX_WATCHLIST_SIZE, INSTRUMENT_CATALOG, CATALOG_BY_ASSET, ASSET_DEFINITIONS, INSTRUMENT_TYPES, DEFAULT_ASSETS, FRESHNESS_THRESHOLDS, getCatalogItem, searchCatalog, isValidMarket, createDefaultWatchlist, serializeWatchlist, deserializeWatchlist, addWatchlistMarket, removeWatchlistMarket, reorderWatchlistMarket, createEmptyQuote, getFreshness, normalizeBinanceTicker, normalizeCoinbaseTicker, normalizeHyperliquidMeta, calculateReferenceQuote, formatPrice, formatCompactPrice, formatPercentage, formatVolume };');
const M = moduleFn();

console.log("=== RUNNING DETERMINISTIC MARKET MODEL & WATCHLIST TESTS ===");

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

// === WATCHLIST & CATALOG DETERMINISTIC TESTS ===

// Test 7: Default Watchlist structure and schema version
const defaultWl = M.createDefaultWatchlist();
assert.strictEqual(defaultWl.version, 1);
assert.strictEqual(defaultWl.items.length, 4);
assert.deepStrictEqual(defaultWl.items.map(i => i.asset), ["BTC", "ETH", "SOL", "HYPE"]);
assert.strictEqual(defaultWl.items[0].instrument, "BTC_USD_SPOT");
assert.strictEqual(defaultWl.items[3].instrument, "HYPE_USD_PERP");
console.log("✓ Default watchlist structure verified (BTC, ETH, SOL, HYPE)");

// Test 8: Serialization & Deserialization roundtrip
const serialized = M.serializeWatchlist(defaultWl);
assert.ok(typeof serialized === "string");
const deserialized = M.deserializeWatchlist(serialized);
assert.strictEqual(deserialized.version, 1);
assert.strictEqual(deserialized.items.length, 4);
assert.strictEqual(deserialized.items[0].asset, "BTC");
console.log("✓ Watchlist serialization & deserialization roundtrip verified");

// Test 9: Legacy bare string array migration (BTC, ETH, SOL, HYPE)
const legacyJson = JSON.stringify(["BTC", "ETH", "SOL", "HYPE", "DOGE"]);
const migrated = M.deserializeWatchlist(legacyJson);
assert.strictEqual(migrated.version, 1);
assert.strictEqual(migrated.items.length, 5);
assert.strictEqual(migrated.items[4].asset, "DOGE");
assert.strictEqual(migrated.items[4].name, "Dogecoin");
assert.strictEqual(migrated.items[4].instrument, "DOGE_USD_SPOT");
console.log("✓ Legacy string array seamless migration verified");

// Test 10: Malformed & missing persistence data recovery
assert.strictEqual(M.deserializeWatchlist(null).items.length, 4);
assert.strictEqual(M.deserializeWatchlist("").items.length, 4);
assert.strictEqual(M.deserializeWatchlist("invalid json {{{").items.length, 4);
assert.strictEqual(M.deserializeWatchlist("{}").items.length, 4);
assert.strictEqual(M.deserializeWatchlist('{"items":[{"asset":"UNKNOWN_COIN"}]}').items.length, 4);
console.log("✓ Malformed/missing persistence data safe fallback verified");

// Test 11: Catalog Search & Aliases
const searchDoge = M.searchCatalog("dogecoin");
assert.ok(searchDoge.length > 0);
assert.strictEqual(searchDoge[0].asset, "DOGE");
assert.strictEqual(searchDoge[0].name, "Dogecoin");

const searchBtc = M.searchCatalog("bitcoin");
assert.strictEqual(searchBtc[0].asset, "BTC");

const searchEth = M.searchCatalog("ether");
assert.strictEqual(searchEth[0].asset, "ETH");

const searchSol = M.searchCatalog("sol");
assert.strictEqual(searchSol[0].asset, "SOL");

const searchPartial = M.searchCatalog("bit");
assert.ok(searchPartial.some(i => i.asset === "BTC"));
assert.ok(searchPartial.some(i => i.asset === "BCH"));
console.log("✓ Catalog search & alias resolution verified (dogecoin->DOGE, bitcoin->BTC, ether->ETH)");

// Test 12: Instrument mapping
const dogeCat = M.getCatalogItem("DOGE");
assert.strictEqual(dogeCat.providers.binance, "DOGEUSDT");
assert.strictEqual(dogeCat.providers.coinbase, "DOGE-USD");
assert.strictEqual(dogeCat.providers.hyperliquid, "DOGE");
console.log("✓ Instrument provider mapping verified (Binance/Coinbase/Hyperliquid)");

// Test 13: Adding valid markets & Duplicate prevention
const addDoge = M.addWatchlistMarket(defaultWl, "DOGE");
assert.strictEqual(addDoge.success, true);
assert.strictEqual(addDoge.watchlist.items.length, 5);
assert.strictEqual(addDoge.watchlist.items[4].asset, "DOGE");

// Duplicate add attempt
const addDogeDup = M.addWatchlistMarket(addDoge.watchlist, "dogecoin");
assert.strictEqual(addDogeDup.success, false);
assert.strictEqual(addDogeDup.reason, "DUPLICATE");
console.log("✓ Add market and duplicate prevention verified");

// Test 14: Rejecting arbitrary/invalid symbols
const addInvalid = M.addWatchlistMarket(defaultWl, "NOT_A_REAL_CRYPTO_TOKEN_XYZ");
assert.strictEqual(addInvalid.success, false);
assert.strictEqual(addInvalid.reason, "INVALID_MARKET");
console.log("✓ Rejection of arbitrary/invalid market symbols verified");

// Test 15: Maximum size constraint (20 items)
let wl20 = M.createDefaultWatchlist();
const allCatalogAssets = M.INSTRUMENT_CATALOG.map(c => c.asset);
for (let i = 0; i < allCatalogAssets.length; i++) {
  const res = M.addWatchlistMarket(wl20, allCatalogAssets[i]);
  if (res.success) wl20 = res.watchlist;
}
assert.strictEqual(wl20.items.length, 20);
const overflowAttempt = M.addWatchlistMarket(wl20, "TAO");
assert.strictEqual(overflowAttempt.success, false);
assert.strictEqual(overflowAttempt.reason, "MAX_LIMIT");
console.log("✓ Maximum watchlist size constraint (20 markets) verified");

// Test 16: Reordering
const wlToReorder = M.createDefaultWatchlist(); // ["BTC", "ETH", "SOL", "HYPE"]
const reordered = M.reorderWatchlistMarket(wlToReorder, 2, 0); // Move SOL to index 0
assert.strictEqual(reordered.success, true);
assert.deepStrictEqual(reordered.watchlist.items.map(i => i.asset), ["SOL", "BTC", "ETH", "HYPE"]);
console.log("✓ Reordering markets verified (SOL moved to top)");

// Test 17: Removing markets
const removed = M.removeWatchlistMarket(reordered.watchlist, "ETH");
assert.strictEqual(removed.success, true);
assert.deepStrictEqual(removed.watchlist.items.map(i => i.asset), ["SOL", "BTC", "HYPE"]);

// Minimum limit protection (cannot remove when only 1 left)
let singleItemWl = { version: 1, items: [M.getCatalogItem("BTC")] };
const removeLast = M.removeWatchlistMarket(singleItemWl, "BTC");
assert.strictEqual(removeLast.success, false);
assert.strictEqual(removeLast.reason, "MIN_LIMIT");
console.log("✓ Removing markets and minimum limit guard verified");

console.log("\nALL 17 TEST SUITES PASSED DETERMINISTICALLY! ✓\n");

