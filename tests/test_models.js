// test_models.js - Deterministic tests for MarketModel & Dynamic Watchlist

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Load MarketModel.js by stripping .pragma library for Node environment
const code = fs.readFileSync(path.join(__dirname, '../models/MarketModel.js'), 'utf8')
  .replace('.pragma library', '');
const moduleFn = new Function(code + '; return { SCHEMA_VERSION, MAX_WATCHLIST_SIZE, INSTRUMENT_CATALOG, CATALOG_BY_ASSET, ASSET_DEFINITIONS, INSTRUMENT_TYPES, DEFAULT_ASSETS, FRESHNESS_THRESHOLDS, getCatalogItem, searchCatalog, isValidMarket, createDefaultWatchlist, serializeWatchlist, deserializeWatchlist, addWatchlistMarket, removeWatchlistMarket, reorderWatchlistMarket, createEmptyQuote, getFreshness, normalizeBinanceTicker, normalizeCoinbaseTicker, normalizeHyperliquidMeta, normalizeYahooChart, normalizeYahooCandles, calculateReferenceQuote, formatPrice, formatCompactPrice, formatPercentage, formatVolume };');
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

// === YAHOO FINANCE & STOCK MARKET DETERMINISTIC TESTS ===

// Test 18: Yahoo Chart Normalization with real AAPL fixture
const aaplRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/yahoo_aapl.json'), 'utf8'));
const aaplQuote = M.normalizeYahooChart(aaplRaw, 1787590000000); // regular trading session time
assert.ok(aaplQuote, "AAPL quote should not be null");
assert.strictEqual(aaplQuote.asset, "AAPL");
assert.strictEqual(aaplQuote.instrument, "AAPL_USD_STOCK");
assert.strictEqual(aaplQuote.priceType, "STOCK_LAST");
assert.strictEqual(aaplQuote.assetClass, "stock");
assert.strictEqual(aaplQuote.provider, "yahoo");
assert.strictEqual(aaplQuote.exchange, "NASDAQ");
assert.ok(Number.isFinite(aaplQuote.price) && aaplQuote.price > 0, "Price must be a positive finite number");
assert.ok(Number.isFinite(aaplQuote.open) && aaplQuote.open > 0, "Regular open must be a positive finite number");
assert.ok(Number.isFinite(aaplQuote.previousClose) && aaplQuote.previousClose > 0, "Previous close must be a positive finite number");
assert.ok(Number.isFinite(aaplQuote.change24h), "change24h must be finite");
assert.ok(Number.isFinite(aaplQuote.changeAmount), "changeAmount must be finite");

// Internal consistency validation
const expectedChangeAmount = aaplQuote.price - aaplQuote.previousClose;
assert.ok(Math.abs(aaplQuote.changeAmount - expectedChangeAmount) < 0.001, "changeAmount must equal price - previousClose");
const expectedChangePercent = (expectedChangeAmount / aaplQuote.previousClose) * 100;
assert.ok(Math.abs(aaplQuote.change24h - expectedChangePercent) < 0.01, "change24h % must match (change / prevClose) * 100");
assert.strictEqual(aaplQuote.freshness, "LIVE");
console.log("✓ Yahoo Chart Normalization passed (AAPL Stock: $" + aaplQuote.price.toFixed(2) + ", Open: $" + aaplQuote.open.toFixed(2) + ", PrevClose: $" + aaplQuote.previousClose.toFixed(2) + ", Change: " + aaplQuote.change24h.toFixed(2) + "%)");

// Test 19: Backward Scanning on Null-Padded Chart Series
const paddedChart = {
  chart: {
    result: [{
      meta: {
        symbol: "MSFT",
        regularMarketPrice: 420.0,
        previousClose: 418.0,
        currentTradingPeriod: {
          regular: { start: 1000, end: 2000 }
        }
      },
      timestamp: [1000, 1100, 1200, 1300],
      indicators: {
        quote: [{
          open: [419.0, 420.0, 422.0, null],
          high: [421.0, 423.0, 424.0, null],
          low: [418.0, 419.0, 421.0, null],
          close: [420.0, 422.5, null, null],
          volume: [1000, 2000, null, null]
        }]
      }
    }]
  }
};
const msftQuote = M.normalizeYahooChart(paddedChart, 1500000);
assert.ok(msftQuote);
assert.strictEqual(msftQuote.price, 422.5, "Latest non-null close should be extracted via backward scan");
assert.strictEqual(msftQuote.open, 419.0, "Regular open from first bar");
console.log("✓ Backward scanning on null-padded chart series verified");

// Test 20: Market Session States & Post-Market Reference Close
const sessionTestChart = {
  chart: {
    result: [{
      meta: {
        symbol: "NVDA",
        regularMarketPrice: 130.0,
        previousClose: 125.0,
        currentTradingPeriod: {
          pre: { start: 100, end: 200 },
          regular: { start: 200, end: 500 },
          post: { start: 500, end: 700 }
        }
      },
      timestamp: [150, 200, 400, 500, 600],
      indicators: {
        quote: [{
          open: [126.0, 127.0, 129.0, 130.0, 132.0],
          high: [127.0, 128.0, 131.0, 131.0, 133.0],
          low: [125.0, 126.0, 128.0, 129.0, 131.0],
          close: [126.5, 127.5, 130.0, 131.0, 132.5],
          volume: [10, 20, 30, 40, 50]
        }]
      }
    }]
  }
};

// 20a: Pre-market
const preQuote = M.normalizeYahooChart(sessionTestChart, 150 * 1000);
assert.strictEqual(preQuote.marketState, "preMarket");
assert.strictEqual(preQuote.previousClose, 125.0, "Pre-market reference is previous trading day close");

// 20b: Regular session
const regQuote = M.normalizeYahooChart(sessionTestChart, 350 * 1000);
assert.strictEqual(regQuote.marketState, "regular");
assert.strictEqual(regQuote.previousClose, 125.0, "Regular session reference is previous trading day close");

// 20c: Post-market (reference close is today's regular session close at/before regular.end=500 -> 131.0)
const postQuote = M.normalizeYahooChart(sessionTestChart, 650 * 1000);
assert.strictEqual(postQuote.marketState, "postMarket");
assert.strictEqual(postQuote.previousClose, 131.0, "Post-market reference is today regular close at regular.end");
assert.strictEqual(postQuote.price, 132.5);
assert.strictEqual(postQuote.changeAmount, 1.5); // 132.5 - 131.0

// 20d: Closed session (e.g. overnight timestamp 800)
const closedQuote = M.normalizeYahooChart(sessionTestChart, 800 * 1000);
assert.strictEqual(closedQuote.marketState, "closed");
console.log("✓ Market session states & post-market reference close verified");

// Test 21: Yahoo Candle Normalization
const candles = M.normalizeYahooCandles(sessionTestChart);
assert.strictEqual(candles.length, 5);
assert.strictEqual(candles[0].time, 150 * 1000);
assert.strictEqual(candles[0].open, 126.0);
assert.strictEqual(candles[0].close, 126.5);
assert.strictEqual(candles[4].time, 600 * 1000);
assert.strictEqual(candles[4].close, 132.5);
console.log("✓ Yahoo Candle normalization verified");

// Test 22: Stock Catalog Search & Asset Class tagging
const searchApple = M.searchCatalog("apple");
assert.ok(searchApple.length > 0);
assert.strictEqual(searchApple[0].asset, "AAPL");
assert.strictEqual(searchApple[0].assetClass, "stock");

const searchNvda = M.searchCatalog("nvidia");
assert.strictEqual(searchNvda[0].asset, "NVDA");
assert.strictEqual(searchNvda[0].assetClass, "stock");

const searchBtcClass = M.searchCatalog("bitcoin");
assert.strictEqual(searchBtcClass[0].asset, "BTC");
assert.strictEqual(searchBtcClass[0].assetClass, "crypto");
console.log("✓ Stock catalog search & assetClass tagging verified");

// Test 23: Reference Quote for Stocks (Yahoo Provider Isolation)
const stockQuotes = { yahoo: aaplQuote };
const stockRef = M.calculateReferenceQuote("AAPL", stockQuotes, 1787590000000);
assert.strictEqual(stockRef.asset, "AAPL");
assert.strictEqual(stockRef.provider, "yahoo");
assert.strictEqual(stockRef.assetClass, "stock");

// Ensure crypto providers are ignored for stocks
const wrongCryptoQuotes = { binance: btcBinance, coinbase: btcCoinbase };
const emptyStockRef = M.calculateReferenceQuote("AAPL", wrongCryptoQuotes, 1787590000000);
assert.strictEqual(emptyStockRef.provider, "yahoo");
assert.strictEqual(emptyStockRef.price, 0);

// Ensure Yahoo is ignored for crypto
const wrongYahooQuotes = { yahoo: aaplQuote };
const emptyCryptoRef = M.calculateReferenceQuote("BTC", wrongYahooQuotes, 1787590000000);
assert.strictEqual(emptyCryptoRef.provider, "aggregate");
assert.strictEqual(emptyCryptoRef.price, 0);
console.log("✓ Stock reference price & provider boundary isolation verified");

console.log("\nALL 23 TEST SUITES PASSED DETERMINISTICALLY! ✓\n");


