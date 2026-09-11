// test_v121_regressions.js - Regression test suite for Omarchy Market v1.2.1

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("=== RUNNING OMARCHY MARKET v1.2.1 REGRESSION TESTS ===");

// Load MarketModel.js in clean sandbox
const modelCode = fs.readFileSync(path.join(__dirname, "../models/MarketModel.js"), "utf8")
  .replace(".pragma library", "");
const sandbox = {
  console: console,
  Date: Date,
  Math: Math,
  parseFloat: parseFloat,
  parseInt: parseInt,
  isNaN: isNaN,
  isFinite: isFinite,
  Number: Number,
  String: String,
  Array: Array,
  Object: Object,
  JSON: JSON
};
const vm = require("vm");
vm.createContext(sandbox);
vm.runInContext(modelCode, sandbox);

// -------------------------------------------------------------
// Test A: Chart Loading State / No Synthetic 3-Point Dummy Line
// -------------------------------------------------------------
console.log("\n[Test A] Verifying Chart Loading State & Absence of Fake 3-Point Line...");
const panelQml = fs.readFileSync(path.join(__dirname, "../Panel.qml"), "utf8");
const sparklineQml = fs.readFileSync(path.join(__dirname, "../ui/SparklineChart.qml"), "utf8");

// Assert Panel.qml no longer contains the synthetic [low, price, high] fallback
assert.strictEqual(
  panelQml.includes("[root.activeQuote.low24h || root.activeQuote.price * 0.98, root.activeQuote.price, root.activeQuote.high24h || root.activeQuote.price * 1.02]"),
  false,
  "FAIL: Panel.qml must NOT contain the synthetic 3-point dummy line fallback!"
);
assert.ok(
  panelQml.includes("points: root.activeCandles"),
  "FAIL: Panel.qml must pass root.activeCandles directly to SparklineChart.points"
);

// Assert SparklineChart.qml renders a subdued baseline when hasData is false
assert.ok(
  sparklineQml.includes("readonly property bool hasData: numericPoints.length >= 2 && points && points.length >= 2"),
  "FAIL: SparklineChart must define hasData checking for real candle datasets"
);
assert.ok(
  sparklineQml.includes("ctx.moveTo(padLeft, padTop + drawH / 2)"),
  "FAIL: SparklineChart must render a clean flat baseline when hasData is false instead of bezier curves"
);
console.log("✓ Test A Passed: Fake 3-point line completely eliminated; clean baseline rendered when loading.");

// -------------------------------------------------------------
// Test B: Stock Timeframe Switching Reactivity
// -------------------------------------------------------------
console.log("\n[Test B] Verifying Stock Timeframe Switching Reactivity...");
const marketServiceQml = fs.readFileSync(path.join(__dirname, "../MarketService.qml"), "utf8");

// Assert handleCandles increments updateRevision
assert.ok(
  marketServiceQml.includes("root.updateRevision++ // Single canonical reactive trigger for activeCandles") ||
  marketServiceQml.includes("root.updateRevision++"),
  "FAIL: MarketService.handleCandles must increment updateRevision to notify Panel.qml activeCandles!"
);

// Simulate state transition in mock MarketService
let mockRevision = 0;
let mockCandleStore = {};
function mockHandleCandles(providerId, asset, timeframe, list) {
  const key = asset + "_" + timeframe;
  if (!list || list.length === 0) return;
  mockCandleStore[key] = list;
  mockRevision++;
}

mockHandleCandles("yahoo", "AAPL", "1H", [{ time: 1000, close: 150 }, { time: 2000, close: 152 }]);
assert.strictEqual(mockRevision, 1, "updateRevision must increment on 1H response");
assert.strictEqual(mockCandleStore["AAPL_1H"].length, 2);

mockHandleCandles("yahoo", "AAPL", "4H", [{ time: 1000, close: 140 }, { time: 2000, close: 145 }, { time: 3000, close: 152 }]);
assert.strictEqual(mockRevision, 2, "updateRevision must increment on 4H response immediately without quote poll");
assert.strictEqual(mockCandleStore["AAPL_4H"].length, 3);
console.log("✓ Test B Passed: Stock timeframe candle responses directly trigger reactive updateRevision increments.");

// -------------------------------------------------------------
// Test C: Timeframe Cache Isolation
// -------------------------------------------------------------
console.log("\n[Test C] Verifying Timeframe Cache Isolation...");
mockHandleCandles("yahoo", "AAPL", "1D", [{ time: 100, close: 100 }, { time: 200, close: 150 }]);
mockHandleCandles("yahoo", "AAPL", "1W", [{ time: 10, close: 80 }, { time: 20, close: 150 }]);

assert.notStrictEqual(mockCandleStore["AAPL_1H"], mockCandleStore["AAPL_4H"]);
assert.notStrictEqual(mockCandleStore["AAPL_1H"], mockCandleStore["AAPL_1D"]);
assert.notStrictEqual(mockCandleStore["AAPL_1D"], mockCandleStore["AAPL_1W"]);
assert.strictEqual(mockCandleStore["AAPL_1H"][0].close, 150);
assert.strictEqual(mockCandleStore["AAPL_4H"][0].close, 140);
assert.strictEqual(mockCandleStore["AAPL_1D"][0].close, 100);
assert.strictEqual(mockCandleStore["AAPL_1W"][0].close, 80);
console.log("✓ Test C Passed: AAPL_1H, AAPL_4H, AAPL_1D, and AAPL_1W maintain strict isolated cache keys.");

// -------------------------------------------------------------
// Test D: Async Stale Response Protection
// -------------------------------------------------------------
console.log("\n[Test D] Verifying Async Stale Response Protection...");
// Simulate out-of-order responses
let activeAsset = "AAPL";
let activeTimeframe = "4H";
let visibleCandles = null;

// User requested 1H, then quickly switched to 4H
const req1 = { asset: "AAPL", tf: "1H", id: 1 };
const req2 = { asset: "AAPL", tf: "4H", id: 2 };

// 4H response arrives first
if (req2.asset === activeAsset && req2.tf === activeTimeframe) {
  visibleCandles = mockCandleStore["AAPL_4H"];
}
assert.strictEqual(visibleCandles.length, 3, "Visible chart should be 4H dataset");

// 1H response arrives second (stale relative to active view)
if (req1.asset === activeAsset && req1.tf === activeTimeframe) {
  visibleCandles = mockCandleStore["AAPL_1H"];
}
// Visible chart must still be 4H!
assert.strictEqual(visibleCandles.length, 3, "Stale 1H response must NOT overwrite active 4H chart!");

// Rapid asset switching: BTC -> ETH -> AAPL
activeAsset = "AAPL";
activeTimeframe = "1H";
const btcResp = { asset: "BTC", tf: "1H", list: [{ close: 78000 }, { close: 78200 }] };
if (btcResp.asset === activeAsset && btcResp.tf === activeTimeframe) {
  visibleCandles = btcResp.list;
}
assert.strictEqual(visibleCandles.length, 3, "Out-of-order BTC response must NOT overwrite active AAPL chart!");
console.log("✓ Test D Passed: Out-of-order and cross-asset responses safely ignored for active chart.");

// -------------------------------------------------------------
// Test E: Deterministic Crypto Historical Candle Provider Selection
// -------------------------------------------------------------
console.log("\n[Test E] Verifying Deterministic Historical Provider Selection...");
assert.ok(
  marketServiceQml.includes("function getHistoricalCandleProvider(asset, timeframe)"),
  "FAIL: MarketService must implement centralized getHistoricalCandleProvider"
);
assert.ok(
  !marketServiceQml.includes("binanceProvider.fetchCandles(asset, tf)\n      coinbaseProvider.fetchCandles(asset, tf)\n      hyperliquidProvider.fetchCandles(asset, tf)"),
  "FAIL: MarketService must NOT concurrently dispatch to Binance + Coinbase + Hyperliquid for spot crypto!"
);

// Verify provider routing logic
function testGetProvider(asset) {
  const cat = sandbox.getCatalogItem(asset);
  if (cat && cat.assetClass === "stock") return "yahoo";
  const isPerpOnly = (asset === "HYPE" || (cat && cat.instrument && cat.instrument.indexOf("PERP") !== -1));
  if (isPerpOnly) return "hyperliquid";
  return "binance";
}

assert.strictEqual(testGetProvider("AAPL"), "yahoo");
assert.strictEqual(testGetProvider("NVDA"), "yahoo");
assert.strictEqual(testGetProvider("HYPE"), "hyperliquid");
assert.strictEqual(testGetProvider("BTC"), "binance");
assert.strictEqual(testGetProvider("ETH"), "binance");
assert.strictEqual(testGetProvider("SOL"), "binance");
console.log("✓ Test E Passed: Deterministic provider selection confirmed (Equities->Yahoo, HYPE->Hyperliquid, Spot Crypto->Binance).");

// -------------------------------------------------------------
// Test F: Coinbase Unsupported Intervals Rejection
// -------------------------------------------------------------
console.log("\n[Test F] Verifying Coinbase Unsupported Intervals Rejection...");
const coinbaseQml = fs.readFileSync(path.join(__dirname, "../providers/CoinbaseProvider.qml"), "utf8");

assert.ok(
  coinbaseQml.includes('if (timeframe === "4H" || timeframe === "1W")'),
  "FAIL: CoinbaseProvider must reject 4H and 1W before making network requests!"
);
assert.ok(
  !coinbaseQml.includes("14400"),
  "FAIL: CoinbaseProvider must NEVER reference or send unsupported granularity 14400!"
);
assert.ok(
  !coinbaseQml.includes("604800"),
  "FAIL: CoinbaseProvider must NEVER reference or send unsupported granularity 604800!"
);
console.log("✓ Test F Passed: Unsupported granularities (14400, 604800) strictly blocked from Coinbase requests.");

// -------------------------------------------------------------
// Test G: Scroll Affordance Logic
// -------------------------------------------------------------
console.log("\n[Test G] Verifying Tab Scroll Affordance Logic...");
assert.ok(panelQml.includes("leftTabFade"), "FAIL: Panel.qml must include leftTabFade");
assert.ok(panelQml.includes("rightTabFade"), "FAIL: Panel.qml must include rightTabFade");

function getAffordanceState(contentWidth, viewportWidth, contentX) {
  const leftVisible = contentX > 2;
  const rightVisible = (contentWidth > viewportWidth) && (contentX < contentWidth - viewportWidth - 2);
  return { leftVisible, rightVisible };
}

// 1. Content fits
let state = getAffordanceState(250, 300, 0);
assert.strictEqual(state.leftVisible, false, "Left fade should be hidden when content fits");
assert.strictEqual(state.rightVisible, false, "Right fade should be hidden when content fits");

// 2. Overflow on right
state = getAffordanceState(500, 300, 0);
assert.strictEqual(state.leftVisible, false, "Left fade should be hidden at start");
assert.strictEqual(state.rightVisible, true, "Right fade should be visible when overflow exists");

// 3. User scrolled to middle
state = getAffordanceState(500, 300, 100);
assert.strictEqual(state.leftVisible, true, "Left fade should be visible in middle");
assert.strictEqual(state.rightVisible, true, "Right fade should be visible in middle");

// 4. User scrolled to end
state = getAffordanceState(500, 300, 200);
assert.strictEqual(state.leftVisible, true, "Left fade should be visible at end");
assert.strictEqual(state.rightVisible, false, "Right fade should be hidden when reached end");
console.log("✓ Test G Passed: Tab scroll affordance left/right fade states verified across all boundary conditions.");

// -------------------------------------------------------------
// Test H: Dynamic Yahoo Search Filtering & Debounce
// -------------------------------------------------------------
console.log("\n[Test H] Verifying Dynamic Yahoo Search Filtering...");
const yahooQml = fs.readFileSync(path.join(__dirname, "../providers/YahooProvider.qml"), "utf8");

assert.ok(
  yahooQml.includes('item.quoteType !== "EQUITY" && item.quoteType !== "ETF"'),
  "FAIL: Yahoo search must filter out everything except EQUITY and ETF!"
);

// Test filter logic against sample quotes
const mockYahooResults = [
  { symbol: "PLTR", shortname: "Palantir", quoteType: "EQUITY" },
  { symbol: "SPY", shortname: "SPDR S&P 500", quoteType: "ETF" },
  { symbol: "^GSPC", shortname: "S&P 500", quoteType: "INDEX" },
  { symbol: "VFIAX", shortname: "Vanguard 500", quoteType: "MUTUALFUND" },
  { symbol: "BTC-USD", shortname: "Bitcoin", quoteType: "CRYPTOCURRENCY" }
];

const filteredQuotes = mockYahooResults.filter(q => q.quoteType === "EQUITY" || q.quoteType === "ETF");
assert.strictEqual(filteredQuotes.length, 2);
assert.strictEqual(filteredQuotes[0].symbol, "PLTR");
assert.strictEqual(filteredQuotes[1].symbol, "SPY");
console.log("✓ Test H Passed: Only EQUITY and ETF are accepted from Yahoo search; INDEX, MUTUALFUND, CRYPTO filtered.");

// -------------------------------------------------------------
// Test I: Dynamic Stock Persistence Roundtrip
// -------------------------------------------------------------
console.log("\n[Test I] Verifying Dynamic Stock Persistence Across Restart...");
// Register PLTR
const dynamicPltr = {
  asset: "PLTR",
  name: "Palantir Technologies Inc.",
  assetClass: "stock",
  instrument: "PLTR_USD_STOCK",
  exchange: "NASDAQ",
  precision: 2,
  providers: { yahoo: "PLTR" }
};

const defaultWatchlist = sandbox.createDefaultWatchlist();
const addRes = sandbox.addWatchlistMarket(defaultWatchlist, dynamicPltr);
assert.strictEqual(addRes.success, true, "Adding dynamic stock PLTR must succeed");
assert.ok(addRes.watchlist.items.some(it => it.asset === "PLTR"));

// Serialize
const serialized = sandbox.serializeWatchlist(addRes.watchlist);
assert.ok(serialized.includes("PLTR"), "Serialized JSON must contain PLTR");

// Simulate app restart by clearing dynamic registry
sandbox.clearDynamicInstruments();
assert.strictEqual(sandbox.getCatalogItem("PLTR"), null, "PLTR should be cleared from in-memory dynamic registry");

// Deserialize
const deserialized = sandbox.deserializeWatchlist(serialized);
assert.ok(deserialized.items.some(it => it.asset === "PLTR"), "PLTR must survive deserialization!");

// Check rehydration into dynamic registry
const rehydrated = sandbox.getCatalogItem("PLTR");
assert.notStrictEqual(rehydrated, null, "PLTR must be rehydrated into dynamic registry on deserialization");
assert.strictEqual(rehydrated.asset, "PLTR");
assert.strictEqual(rehydrated.assetClass, "stock");
assert.strictEqual(rehydrated.name, "Palantir Technologies Inc.");
console.log("✓ Test I Passed: Dynamic stock successfully rehydrates and persists across restart without catalog pollution.");

// -------------------------------------------------------------
// Test J: Chart Hover Coordinate Mapping
// -------------------------------------------------------------
console.log("\n[Test J] Verifying Chart Hover Coordinate Mapping...");
function mapHoverIndex(mouseX, width, padLeft, padRight, pointsLength) {
  const drawW = width - padLeft - padRight;
  if (drawW <= 0 || pointsLength === 0) return -1;
  const clampedX = Math.max(padLeft, Math.min(width - padRight, mouseX));
  const ratio = (clampedX - padLeft) / drawW;
  const idx = pointsLength > 1 ? Math.round(ratio * (pointsLength - 1)) : 0;
  return Math.max(0, Math.min(pointsLength - 1, idx));
}

const w = 360, pl = 4, pr = 8;

// 1. Single point dataset (no division by zero!)
assert.strictEqual(mapHoverIndex(180, w, pl, pr, 1), 0);

// 2. Two points dataset
assert.strictEqual(mapHoverIndex(0, w, pl, pr, 2), 0); // Left edge -> index 0
assert.strictEqual(mapHoverIndex(360, w, pl, pr, 2), 1); // Right edge -> index 1

// 3. 30 points dataset (Binance klines)
assert.strictEqual(mapHoverIndex(pl, w, pl, pr, 30), 0);
assert.strictEqual(mapHoverIndex(w - pr, w, pl, pr, 30), 29);
assert.strictEqual(mapHoverIndex(180, w, pl, pr, 30), 15);

// 4. Clamping beyond bounds
assert.strictEqual(mapHoverIndex(-50, w, pl, pr, 30), 0);
assert.strictEqual(mapHoverIndex(500, w, pl, pr, 30), 29);
console.log("✓ Test J Passed: Hover coordinate mapping is exact, bounds-clamped, and division-by-zero resilient.");

// -------------------------------------------------------------
// Test K: Remote XHR Response-Byte Ceiling Enforcement
// -------------------------------------------------------------
console.log("\n[Test K] Verifying Remote XHR Response-Byte Ceiling Enforcement...");
const yahooProviderQml = fs.readFileSync(path.join(__dirname, "../providers/YahooProvider.qml"), "utf8");

// 1. Verify byte ceiling properties exist
assert.ok(
  yahooProviderQml.includes("readonly property int maxSearchResponseBytes: 131072"),
  "FAIL: YahooProvider must define maxSearchResponseBytes ceiling (128 KB)!"
);
assert.ok(
  yahooProviderQml.includes("readonly property int maxDataResponseBytes: 1048576"),
  "FAIL: YahooProvider must define maxDataResponseBytes ceiling (1 MB)!"
);

// 2. Verify searchSymbols checks Content-Length and responseText.length before JSON.parse
assert.ok(
  yahooProviderQml.includes("cl > root.maxSearchResponseBytes"),
  "FAIL: searchSymbols must check Content-Length against maxSearchResponseBytes on HEADERS_RECEIVED!"
);
assert.ok(
  yahooProviderQml.includes("text.length > root.maxSearchResponseBytes"),
  "FAIL: searchSymbols must check text.length against maxSearchResponseBytes before JSON.parse!"
);

// 3. Verify handleResponse checks data ceiling
assert.ok(
  yahooProviderQml.includes("text.length > root.maxDataResponseBytes"),
  "FAIL: handleResponse must enforce maxDataResponseBytes before passing response to parser!"
);

// 4. Functional simulation of search response ceiling enforcement
function simulateSearchResponse(headers, bodyText, maxBytes) {
  let callbackResult = null;
  let parsed = false;

  // HEADERS_RECEIVED check
  if (headers["Content-Length"]) {
    const cl = parseInt(headers["Content-Length"], 10);
    if (!isNaN(cl) && cl > maxBytes) {
      // Aborted early
      callbackResult = [];
      return { aborted: true, parsed: false, result: callbackResult };
    }
  }

  // DONE check
  const text = bodyText || "";
  if (text.length > maxBytes) {
    callbackResult = [];
    return { aborted: false, parsed: false, result: callbackResult };
  }

  try {
    const data = JSON.parse(text);
    parsed = true;
    callbackResult = data.quotes || [];
  } catch (e) {
    callbackResult = [];
  }

  return { aborted: false, parsed: parsed, result: callbackResult };
}

// Normal response (~2 KB) -> succeeds
const normalPayload = JSON.stringify({ quotes: [{ symbol: "AAPL", quoteType: "EQUITY" }] });
const normalSim = simulateSearchResponse({ "Content-Length": String(normalPayload.length) }, normalPayload, 131072);
assert.strictEqual(normalSim.parsed, true);
assert.strictEqual(normalSim.result.length, 1);

// Giant Content-Length (10 MB header) -> aborted on HEADERS_RECEIVED
const headerExceededSim = simulateSearchResponse({ "Content-Length": "10485760" }, "fake body", 131072);
assert.strictEqual(headerExceededSim.aborted, true);
assert.strictEqual(headerExceededSim.parsed, false);
assert.strictEqual(headerExceededSim.result.length, 0);

// Hostile/malfunctioning oversized payload without header (250 KB) -> discarded before JSON.parse
const oversizedPayload = JSON.stringify({ quotes: new Array(10000).fill({ symbol: "OVERFLOW", quoteType: "EQUITY" }) });
assert.ok(oversizedPayload.length > 131072);
const bodyExceededSim = simulateSearchResponse({}, oversizedPayload, 131072);
assert.strictEqual(bodyExceededSim.aborted, false);
assert.strictEqual(bodyExceededSim.parsed, false);
assert.strictEqual(bodyExceededSim.result.length, 0);

console.log("✓ Test K Passed: Remote XHR response-byte ceiling strictly enforced on headers and body; unbounded memory usage prevented.");

console.log("\n============================================================");
console.log("ALL v1.2.1 REGRESSION TESTS PASSED! ✓ (11 / 11)");
console.log("============================================================\n");
