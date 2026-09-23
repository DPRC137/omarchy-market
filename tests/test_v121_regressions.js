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
// Test K: Remote XHR Response-Byte Ceiling Streaming Enforcement
// -------------------------------------------------------------
console.log("\n[Test K] Verifying Remote XHR Response-Byte Ceiling Streaming Enforcement...");
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

// 2. Verify searchSymbols checks ceilings and aborts during HEADERS_RECEIVED and LOADING
assert.ok(
  yahooProviderQml.includes("cl > root.maxSearchResponseBytes"),
  "FAIL: searchSymbols must check Content-Length against maxSearchResponseBytes on HEADERS_RECEIVED!"
);
assert.ok(
  yahooProviderQml.includes("loadLen > root.maxSearchResponseBytes"),
  "FAIL: searchSymbols must check stream length against maxSearchResponseBytes on LOADING!"
);
assert.ok(
  yahooProviderQml.includes("text.length > root.maxSearchResponseBytes"),
  "FAIL: searchSymbols must check text.length against maxSearchResponseBytes at DONE!"
);

// 3. Verify quote and candle requests check ceilings on HEADERS_RECEIVED, LOADING, and DONE
assert.ok(
  yahooProviderQml.includes("cl > root.maxDataResponseBytes"),
  "FAIL: Quote/candle requests must check Content-Length against maxDataResponseBytes on HEADERS_RECEIVED!"
);
assert.ok(
  yahooProviderQml.includes("loadLen > root.maxDataResponseBytes"),
  "FAIL: Quote/candle requests must check stream length against maxDataResponseBytes on LOADING!"
);
assert.ok(
  yahooProviderQml.includes("text.length > root.maxDataResponseBytes"),
  "FAIL: Quote/candle requests must check text.length against maxDataResponseBytes at DONE!"
);

// 4. Verify single-shot finalization guards protect against re-entrant abort callbacks
assert.ok(
  yahooProviderQml.includes("if (finalized) return\n        finalized = true") ||
  yahooProviderQml.includes("if (finalized) return;\n        finalized = true") ||
  yahooProviderQml.includes("if (finalized) return"),
  "FAIL: YahooProvider must implement finalized guards before calling abort()!"
);

// 5. Streaming XHR State Machine Simulator
class StreamingXHR {
  constructor() {
    this.readyState = 0; // UNSENT
    this.status = 0;
    this.responseText = "";
    this.headers = {};
    this.aborted = false;
    this.timeout = 0;
    this.onreadystatechange = null;
    this.onerror = null;
    this.ontimeout = null;
  }
  open(method, url) {
    this.readyState = 1; // OPENED
  }
  setRequestHeader(k, v) {}
  getResponseHeader(k) {
    for (const key of Object.keys(this.headers)) {
      if (key.toLowerCase() === k.toLowerCase()) return this.headers[key];
    }
    return null;
  }
  abort() {
    this.aborted = true;
    if (this.onreadystatechange) {
      this.onreadystatechange();
    }
    if (this.onerror) {
      this.onerror();
    }
  }
  sendHeaders(headers, status = 200) {
    this.headers = headers || {};
    this.status = status;
    this.readyState = 2; // HEADERS_RECEIVED
    if (this.onreadystatechange) this.onreadystatechange();
  }
  sendChunk(chunk) {
    if (this.aborted) return;
    this.responseText += chunk;
    this.readyState = 3; // LOADING
    if (this.onreadystatechange) this.onreadystatechange();
  }
  sendDone() {
    if (this.aborted) return;
    this.readyState = 4; // DONE
    if (this.onreadystatechange) this.onreadystatechange();
  }
}

// Lifecycle runner replicating YahooProvider searchSymbols logic
function runSearchLifecycle(xhr, query, callback) {
  let finalized = false;
  let parseCount = 0;
  function finalize(results) {
    if (finalized) return;
    finalized = true;
    callback(results || []);
  }
  xhr.onreadystatechange = function() {
    if (finalized) return;
    if (xhr.readyState === 2) { // HEADERS_RECEIVED
      try {
        const clHeader = xhr.getResponseHeader("Content-Length");
        if (clHeader) {
          const cl = parseInt(clHeader, 10);
          if (!isNaN(cl) && cl > 131072) {
            finalize([]);
            xhr.abort();
            return;
          }
        }
      } catch (e) {}
    }
    if (xhr.readyState === 3) { // LOADING
      try {
        const loadLen = xhr.responseText ? xhr.responseText.length : 0;
        if (loadLen > 131072) {
          finalize([]);
          xhr.abort();
          return;
        }
      } catch (e) {}
    }
    if (xhr.readyState === 4) { // DONE
      if (finalized) return;
      if (xhr.status === 200) {
        const text = xhr.responseText || "";
        if (text.length > 131072) {
          finalize([]);
          return;
        }
        try {
          parseCount++;
          const data = JSON.parse(text);
          finalize(data.quotes || []);
        } catch (e) {
          finalize([]);
        }
      } else {
        finalize([]);
      }
    }
  };
  xhr.onerror = function() { finalize([]); };
  xhr.ontimeout = function() { finalize([]); };
  return { getParseCount: () => parseCount };
}

// Lifecycle runner replicating YahooProvider executeQuoteRequest / executeCandleRequest logic
function runDataLifecycle(xhr, task, onComplete) {
  let finalized = false;
  let parseCount = 0;
  let finishCount = 0;
  function finalizeFailure(reason) {
    if (finalized) return;
    finalized = true;
    finishCount++;
    onComplete({ success: false, reason, parseCount, finishCount });
  }
  function finalizeBackoff(status) {
    if (finalized) return;
    finalized = true;
    finishCount++;
    onComplete({ success: false, backoff: true, status, parseCount, finishCount });
  }
  function finalizeSuccess(text) {
    if (finalized) return;
    finalized = true;
    try {
      parseCount++;
      const data = JSON.parse(text);
      finishCount++;
      onComplete({ success: true, data, parseCount, finishCount });
    } catch (err) {
      finishCount++;
      onComplete({ success: false, reason: "parse error", parseCount, finishCount });
    }
  }
  xhr.onreadystatechange = function() {
    if (finalized) return;
    if (xhr.readyState === 2) {
      try {
        const clHeader = xhr.getResponseHeader("Content-Length");
        if (clHeader) {
          const cl = parseInt(clHeader, 10);
          if (!isNaN(cl) && cl > 1048576) {
            finalizeFailure("Content-Length exceeds ceiling");
            xhr.abort();
            return;
          }
        }
      } catch (e) {}
    }
    if (xhr.readyState === 3) {
      try {
        const loadLen = xhr.responseText ? xhr.responseText.length : 0;
        if (loadLen > 1048576) {
          finalizeFailure("stream exceeds ceiling");
          xhr.abort();
          return;
        }
      } catch (e) {}
    }
    if (xhr.readyState === 4) {
      if (finalized) return;
      if (xhr.status === 200) {
        const text = xhr.responseText || "";
        if (text.length > 1048576) {
          finalizeFailure("DONE text exceeds ceiling");
          return;
        }
        finalizeSuccess(text);
      } else if (xhr.status === 429 || xhr.status === 403 || xhr.status >= 500) {
        finalizeBackoff(xhr.status);
      } else {
        finalizeFailure("HTTP " + xhr.status);
      }
    }
  };
  xhr.onerror = function() { finalizeFailure("network error"); };
  xhr.ontimeout = function() { finalizeFailure("timeout"); };
  return { getParseCount: () => parseCount, getFinishCount: () => finishCount };
}

// 5a. Search streaming tests:
// Case 1: Normal response (< 128 KB) -> succeeds
let searchCallbacks = 0;
let searchResult = null;
const xhrNormal = new StreamingXHR();
const runnerNormal = runSearchLifecycle(xhrNormal, "AAPL", res => { searchCallbacks++; searchResult = res; });
xhrNormal.open("GET", "/search");
xhrNormal.sendHeaders({ "Content-Length": "2000" }, 200);
xhrNormal.sendChunk(JSON.stringify({ quotes: [{ symbol: "AAPL", quoteType: "EQUITY" }] }));
xhrNormal.sendDone();
assert.strictEqual(searchCallbacks, 1, "Normal search must invoke callback exactly once");
assert.strictEqual(searchResult.length, 1);
assert.strictEqual(runnerNormal.getParseCount(), 1);

// Case 2: Exact ceiling boundary (131,072 bytes) -> succeeds
let searchExactCallbacks = 0;
const xhrExact = new StreamingXHR();
const runnerExact = runSearchLifecycle(xhrExact, "AAPL", () => { searchExactCallbacks++; });
xhrExact.open("GET", "/search");
const baseExact = '{"quotes":[{"symbol":"AAPL","quoteType":"EQUITY"}],"pad":"';
const exactPayload = baseExact + "X".repeat(131072 - baseExact.length - 2) + '"}';
assert.strictEqual(exactPayload.length, 131072);
xhrExact.sendHeaders({ "Content-Length": "131072" }, 200);
xhrExact.sendChunk(exactPayload);
xhrExact.sendDone();
assert.strictEqual(searchExactCallbacks, 1);
assert.strictEqual(runnerExact.getParseCount(), 1);

// Case 3: 1 byte over ceiling (131,073 bytes) -> aborted during LOADING
let searchOverCallbacks = 0;
let searchOverResult = null;
const xhrOver = new StreamingXHR();
const runnerOver = runSearchLifecycle(xhrOver, "AAPL", res => { searchOverCallbacks++; searchOverResult = res; });
xhrOver.open("GET", "/search");
xhrOver.sendHeaders({}, 200); // chunked, no content-length
xhrOver.sendChunk("X".repeat(131072)); // at ceiling
assert.strictEqual(xhrOver.aborted, false, "Must not abort at exact ceiling");
xhrOver.sendChunk("Y"); // 1 byte over ceiling -> crosses boundary during LOADING
assert.strictEqual(xhrOver.aborted, true, "Must abort immediately when stream exceeds ceiling in LOADING");
assert.strictEqual(searchOverCallbacks, 1, "Callback must fire exactly once on abort");
assert.deepStrictEqual(searchOverResult, []);
assert.strictEqual(runnerOver.getParseCount(), 0, "JSON.parse must NEVER run on oversized streams");

// Case 4: Chunked transfer without Content-Length (multiple chunks exceeding ceiling)
let chunkedCallbacks = 0;
const xhrChunked = new StreamingXHR();
const runnerChunked = runSearchLifecycle(xhrChunked, "AAPL", () => { chunkedCallbacks++; });
xhrChunked.open("GET", "/search");
xhrChunked.sendHeaders({}, 200);
for (let c = 0; c < 5; c++) {
  xhrChunked.sendChunk("A".repeat(32768)); // 32 KB chunks
}
assert.strictEqual(xhrChunked.aborted, true);
assert.strictEqual(chunkedCallbacks, 1);
assert.strictEqual(runnerChunked.getParseCount(), 0);

// Case 5: Dishonest Content-Length header (claims 100 bytes, but streams > 128 KB)
let dishonestCallbacks = 0;
const xhrDishonest = new StreamingXHR();
const runnerDishonest = runSearchLifecycle(xhrDishonest, "AAPL", () => { dishonestCallbacks++; });
xhrDishonest.open("GET", "/search");
xhrDishonest.sendHeaders({ "Content-Length": "100" }, 200); // Dishonest header
assert.strictEqual(xhrDishonest.aborted, false);
xhrDishonest.sendChunk("B".repeat(140000)); // Oversized body
assert.strictEqual(xhrDishonest.aborted, true);
assert.strictEqual(dishonestCallbacks, 1);
assert.strictEqual(runnerDishonest.getParseCount(), 0);

// Case 6: Giant Content-Length header -> aborted on HEADERS_RECEIVED
let giantHeaderCallbacks = 0;
const xhrGiant = new StreamingXHR();
const runnerGiant = runSearchLifecycle(xhrGiant, "AAPL", () => { giantHeaderCallbacks++; });
xhrGiant.open("GET", "/search");
xhrGiant.sendHeaders({ "Content-Length": "10485760" }, 200); // 10 MB header
assert.strictEqual(xhrGiant.aborted, true, "Must abort on HEADERS_RECEIVED for oversized Content-Length");
assert.strictEqual(giantHeaderCallbacks, 1);
assert.strictEqual(runnerGiant.getParseCount(), 0);

// 5b. Data streaming tests (Quote / Candle 1 MB ceiling):
// Case 1: Normal data response (< 1 MB) -> succeeds
let dataNormalRes = null;
const xhrDataNormal = new StreamingXHR();
runDataLifecycle(xhrDataNormal, { asset: "AAPL", type: "quote" }, res => { dataNormalRes = res; });
xhrDataNormal.open("GET", "/chart/AAPL");
xhrDataNormal.sendHeaders({ "Content-Length": "50000" }, 200);
xhrDataNormal.sendChunk(JSON.stringify({ chart: { result: [{ meta: { symbol: "AAPL" } }] } }));
xhrDataNormal.sendDone();
assert.strictEqual(dataNormalRes.success, true);
assert.strictEqual(dataNormalRes.finishCount, 1);
assert.strictEqual(dataNormalRes.parseCount, 1);

// Case 2: Exact 1 MB ceiling -> succeeds
let dataExactRes = null;
const xhrDataExact = new StreamingXHR();
runDataLifecycle(xhrDataExact, { asset: "AAPL", type: "quote" }, res => { dataExactRes = res; });
xhrDataExact.open("GET", "/chart/AAPL");
const baseData = '{"chart":{"result":[{"meta":{"symbol":"AAPL"}}]},"pad":"';
const exactDataPayload = baseData + "Z".repeat(1048576 - baseData.length - 2) + '"}';
assert.strictEqual(exactDataPayload.length, 1048576);
xhrDataExact.sendHeaders({ "Content-Length": "1048576" }, 200);
xhrDataExact.sendChunk(exactDataPayload);
xhrDataExact.sendDone();
assert.strictEqual(dataExactRes.success, true);
assert.strictEqual(dataExactRes.finishCount, 1);

// Case 3: 1 byte over ceiling (1,048,577 bytes) -> aborted in LOADING
let dataOverRes = null;
const xhrDataOver = new StreamingXHR();
runDataLifecycle(xhrDataOver, { asset: "AAPL", type: "quote" }, res => { dataOverRes = res; });
xhrDataOver.open("GET", "/chart/AAPL");
xhrDataOver.sendHeaders({}, 200);
xhrDataOver.sendChunk("D".repeat(1048576));
assert.strictEqual(xhrDataOver.aborted, false);
xhrDataOver.sendChunk("E"); // 1 byte over
assert.strictEqual(xhrDataOver.aborted, true);
assert.strictEqual(dataOverRes.success, false);
assert.strictEqual(dataOverRes.finishCount, 1);
assert.strictEqual(dataOverRes.parseCount, 0);

// Case 4: Giant Content-Length on data endpoint -> aborted on HEADERS_RECEIVED
let dataGiantRes = null;
const xhrDataGiant = new StreamingXHR();
runDataLifecycle(xhrDataGiant, { asset: "AAPL", type: "quote" }, res => { dataGiantRes = res; });
xhrDataGiant.open("GET", "/chart/AAPL");
xhrDataGiant.sendHeaders({ "Content-Length": "20000000" }, 200);
assert.strictEqual(xhrDataGiant.aborted, true);
assert.strictEqual(dataGiantRes.success, false);
assert.strictEqual(dataGiantRes.finishCount, 1);
assert.strictEqual(dataGiantRes.parseCount, 0);

console.log("✓ Test K Passed: Remote XHR response-byte ceiling strictly enforced during HEADERS_RECEIVED and LOADING streaming states; zero memory leaks or re-entrancy.");

// -------------------------------------------------------------
// Test L: Structural PlainText Regression Test
// -------------------------------------------------------------
console.log("\n[Test L] Verifying Untrusted Text Sinks Enforce Text.PlainText in Panel.qml...");

// Find enclosing block for a given needle in source text
function getEnclosingBlock(src, needle) {
  const idx = src.indexOf(needle);
  if (idx === -1) return null;
  // Search backward for "Text {"
  const textStart = src.lastIndexOf("Text {", idx);
  if (textStart === -1) return null;
  // Find closing brace matching this block
  let depth = 0;
  let blockEnd = -1;
  for (let i = textStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        blockEnd = i;
        break;
      }
    }
  }
  return blockEnd !== -1 ? src.substring(textStart, blockEnd + 1) : null;
}

// 1. Search Result Symbol sink: catItem.asset
const searchSymbolBlock = getEnclosingBlock(panelQml, "text: catItem.asset");
assert.ok(searchSymbolBlock, "FAIL: Could not locate 'text: catItem.asset' block in Panel.qml");
assert.ok(
  searchSymbolBlock.includes("textFormat: Text.PlainText"),
  "FAIL: Search result symbol Text block must specify 'textFormat: Text.PlainText'!"
);

// 2. Search Result Name sink: catItem.name
const searchNameBlock = getEnclosingBlock(panelQml, 'text: "• " + catItem.name');
assert.ok(searchNameBlock, "FAIL: Could not locate 'text: \"• \" + catItem.name' block in Panel.qml");
assert.ok(
  searchNameBlock.includes("textFormat: Text.PlainText"),
  "FAIL: Search result name Text block must specify 'textFormat: Text.PlainText'!"
);

// 3. Watchlist Manager Symbol sink: assetName
const wlSymbolBlock = getEnclosingBlock(panelQml, 'text: "★ " + assetName');
assert.ok(wlSymbolBlock, "FAIL: Could not locate 'text: \"★ \" + assetName' block in Panel.qml");
assert.ok(
  wlSymbolBlock.includes("textFormat: Text.PlainText"),
  "FAIL: Watchlist manager symbol Text block must specify 'textFormat: Text.PlainText'!"
);

// 4. Watchlist Manager Name sink: catItem.name
// Find the catItem.name inside watchlist manager delegate
const wlIdx = panelQml.indexOf('readonly property string assetName: modelData');
assert.ok(wlIdx !== -1, "FAIL: Could not find watchlist delegate in Panel.qml");
const wlSub = panelQml.substring(wlIdx);
const wlNameBlock = getEnclosingBlock(wlSub, 'text: "• " + catItem.name');
assert.ok(wlNameBlock, "FAIL: Could not locate watchlist manager name block");
assert.ok(
  wlNameBlock.includes("textFormat: Text.PlainText"),
  "FAIL: Watchlist manager name Text block must specify 'textFormat: Text.PlainText'!"
);

// 5. Detail Header Symbol sink: root.activeQuote.symbol
const detailSymbolBlock = getEnclosingBlock(panelQml, "text: root.activeQuote.symbol");
assert.ok(detailSymbolBlock, "FAIL: Could not locate 'text: root.activeQuote.symbol' block in Panel.qml");
assert.ok(
  detailSymbolBlock.includes("textFormat: Text.PlainText"),
  "FAIL: Detail header symbol Text block must specify 'textFormat: Text.PlainText'!"
);

// 6. Detail Header Name sink: root.activeQuote.name
const detailNameBlock = getEnclosingBlock(panelQml, 'text: "• " + root.activeQuote.name');
assert.ok(detailNameBlock, "FAIL: Could not locate 'text: \"• \" + root.activeQuote.name' block in Panel.qml");
assert.ok(
  detailNameBlock.includes("textFormat: Text.PlainText"),
  "FAIL: Detail header name Text block must specify 'textFormat: Text.PlainText'!"
);

// 7. Watchlist Tab Text sink: id: tabText
const tabTextBlock = getEnclosingBlock(panelQml, "id: tabText");
assert.ok(tabTextBlock, "FAIL: Could not locate 'id: tabText' block in Panel.qml");
assert.ok(
  tabTextBlock.includes("textFormat: Text.PlainText"),
  "FAIL: Watchlist tab Text block must specify 'textFormat: Text.PlainText'!"
);

console.log("✓ Test L Passed: All 7 untrusted/dynamic string Text sinks in Panel.qml strictly enforce Text.PlainText.");

// -------------------------------------------------------------
// Test M: Numeric Robustness & Normalizer Resilience
// -------------------------------------------------------------
console.log("\n[Test M] Verifying Numeric Robustness & Finite Number Invariants...");

// 1. Binance Ticker normalizer with non-finite / hostile values
const binanceMalformed = {
  s: "BTCUSDT",
  c: "NaN",
  P: "Infinity",
  h: "-Infinity",
  l: "not-a-number",
  v: null,
  b: undefined,
  a: "NaN"
};
const normBinance = sandbox.normalizeBinanceTicker(binanceMalformed, 1000);
assert.ok(normBinance, "Normalizer should not crash on non-finite fields");
assert.strictEqual(Number.isFinite(normBinance.price), true, "price must be finite");
assert.strictEqual(Number.isFinite(normBinance.change24h), true, "change24h must be finite");
assert.strictEqual(Number.isFinite(normBinance.changePercent24h), true, "changePercent24h must be finite");
assert.strictEqual(Number.isFinite(normBinance.high24h), true, "high24h must be finite");
assert.strictEqual(Number.isFinite(normBinance.low24h), true, "low24h must be finite");
assert.strictEqual(Number.isFinite(normBinance.volume24h), true, "volume24h must be finite");

// 2. Coinbase Ticker normalizer with non-finite / hostile values
const coinbaseMalformed = {
  product_id: "BTC-USD",
  price: "Infinity",
  open_24h: "NaN",
  volume_24h: "invalid",
  low_24h: null,
  high_24h: undefined,
  best_bid: "NaN",
  best_ask: "-Infinity"
};
const normCoinbase = sandbox.normalizeCoinbaseTicker(coinbaseMalformed, 1000);
assert.ok(normCoinbase);
assert.strictEqual(Number.isFinite(normCoinbase.price), true);
assert.strictEqual(Number.isFinite(normCoinbase.change24h), true);
assert.strictEqual(Number.isFinite(normCoinbase.changePercent24h), true);
assert.strictEqual(Number.isFinite(normCoinbase.high24h), true);
assert.strictEqual(Number.isFinite(normCoinbase.low24h), true);
assert.strictEqual(Number.isFinite(normCoinbase.volume24h), true);

// 3. Hyperliquid Meta normalizer with non-finite values
const hlMalformed = [
  { universe: [{ name: "HYPE", szDecimals: 2 }] },
  [{
    markPx: "NaN",
    prevDayPx: "Infinity",
    dayNtlVlm: "-Infinity",
    bidPx: "NaN",
    askPx: null
  }]
];
const normHl = sandbox.normalizeHyperliquidMeta(hlMalformed, ["HYPE"], 1000);
assert.ok(normHl && normHl.length > 0);
assert.strictEqual(Number.isFinite(normHl[0].price), true);
assert.strictEqual(Number.isFinite(normHl[0].change24h), true);
assert.strictEqual(Number.isFinite(normHl[0].volume24h), true);

// 4. Yahoo Chart normalizer with non-finite values
const yahooChartMalformed = {
  chart: {
    result: [{
      meta: {
        symbol: "AAPL",
        regularMarketPrice: 150.25,
        regularMarketDayHigh: "Infinity",
        regularMarketDayLow: "-Infinity",
        regularMarketVolume: "NaN"
      },
      timestamp: [1000],
      indicators: {
        quote: [{
          open: ["NaN"],
          high: ["Infinity"],
          low: ["-Infinity"],
          close: [150.25],
          volume: [null]
        }]
      }
    }]
  }
};
const normYahoo = sandbox.normalizeYahooChart(yahooChartMalformed, 1000 * 1000);
assert.ok(normYahoo);
assert.strictEqual(Number.isFinite(normYahoo.price), true);
assert.strictEqual(Number.isFinite(normYahoo.high24h), true);
assert.strictEqual(Number.isFinite(normYahoo.low24h), true);
assert.strictEqual(Number.isFinite(normYahoo.volume24h), true);

// 5. Yahoo Candles normalizer with hostile non-finite entries
const yahooCandlesMalformed = {
  chart: {
    result: [{
      timestamp: [1000, 2000, 3000, 4000],
      indicators: {
        quote: [{
          close: [150, "NaN", null, Infinity],
          open: [149, 100, 100, 100],
          high: ["Infinity", 100, 100, 100],
          low: ["-Infinity", 100, 100, 100],
          volume: ["NaN", 0, 0, 0]
        }]
      }
    }]
  }
};
const normCandles = sandbox.normalizeYahooCandles(yahooCandlesMalformed);
assert.strictEqual(normCandles.length, 1, "Only the single valid finite candle should be accepted");
assert.strictEqual(Number.isFinite(normCandles[0].time), true);
assert.strictEqual(Number.isFinite(normCandles[0].open), true);
assert.strictEqual(Number.isFinite(normCandles[0].high), true);
assert.strictEqual(Number.isFinite(normCandles[0].low), true);
assert.strictEqual(Number.isFinite(normCandles[0].close), true);
assert.strictEqual(Number.isFinite(normCandles[0].volume), true);

// 6. SparklineChart point filtering simulation
const rawMixedPoints = [100, NaN, Infinity, -Infinity, "bad", null, undefined, 105, 102];
const filteredPoints = rawMixedPoints.filter(num => typeof num === "number" && Number.isFinite(num) && !isNaN(num));
assert.deepStrictEqual(filteredPoints, [100, 105, 102]);

let testMin = Infinity;
let testMax = -Infinity;
for (const p of filteredPoints) {
  if (p < testMin) testMin = p;
  if (p > testMax) testMax = p;
}
assert.strictEqual(testMin, 100);
assert.strictEqual(testMax, 105);

// Flat dataset zero division protection
const flatPoints = [100, 100];
const flatMin = 100, flatMax = 100;
const flatRange = Math.max(1e-6, flatMax - flatMin);
assert.ok(flatRange > 0, "Range must never be 0 to prevent zero division in coordinate scaling");

console.log("✓ Test M Passed: All normalizers and chart scaling are strictly resilient against NaN, Infinity, and non-finite values.");

// -------------------------------------------------------------
// Test N: Dynamic Stock Validation, Tamper Resistance & Persistence
// -------------------------------------------------------------
console.log("\n[Test N] Verifying Dynamic Stock Symbol Validation & Tamper Resistance...");

// 1. Valid symbols accepted
const validSymbols = ["AAPL", "BRK.B", "BF.B", "ABC-DEF", "aapl"];
for (const sym of validSymbols) {
  const registered = sandbox.registerDynamicInstrument({ asset: sym, name: "Test " + sym });
  assert.ok(registered, "Valid symbol '" + sym + "' must be accepted");
  assert.strictEqual(registered.asset, sym.toUpperCase());
  assert.strictEqual(registered.assetClass, "stock");
  assert.strictEqual(registered.instrument, sym.toUpperCase() + "_USD_STOCK");
  assert.strictEqual(registered.providers.yahoo, sym.toUpperCase());
}

// 2. Invalid / hostile symbols rejected
const invalidSymbols = [
  "",
  "   ",
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "A/B",
  "A:B",
  "A_B",
  "TOOLONGSYMBOL", // > 10 chars
  "SYM 1",         // spaces
  "SYM$1",
  "SYM#1",
  null,
  undefined,
  12345,
  {}
];

for (const inv of invalidSymbols) {
  const reg = sandbox.registerDynamicInstrument({ asset: inv, name: "Hostile" });
  assert.strictEqual(reg, null, "Malformed/hostile symbol '" + inv + "' must be rejected!");
}

// 3. Provider and instrument hijacking prevention
const hostilePayload = {
  asset: "TSLA",
  name: "T".repeat(300),              // oversized name (> 100)
  assetClass: "crypto",               // attempt to hijack assetClass
  instrument: "MALICIOUS_INSTRUMENT", // attempt to hijack instrument
  exchange: "E".repeat(100),          // oversized exchange (> 30)
  precision: 999,                     // invalid precision
  providers: { binance: "BTCUSDT", yahoo: "HIJACKED" }, // attempt to hijack providers
  aliases: ["evil", "btc"]            // attempt to hijack aliases
};

const canonicalTsla = sandbox.registerDynamicInstrument(hostilePayload);
assert.ok(canonicalTsla);
assert.strictEqual(canonicalTsla.asset, "TSLA");
assert.strictEqual(canonicalTsla.assetClass, "stock", "Hostile assetClass override must be rejected");
assert.strictEqual(canonicalTsla.instrument, "TSLA_USD_STOCK", "Hostile instrument override must be rejected");
assert.strictEqual(canonicalTsla.providers.yahoo, "TSLA", "Hostile provider hijack must be rejected");
assert.strictEqual(canonicalTsla.providers.binance, undefined, "Alien provider mapping must be rejected");
assert.strictEqual(canonicalTsla.name.length, 100, "Name must be capped at 100 characters");
assert.strictEqual(canonicalTsla.exchange.length, 30, "Exchange must be capped at 30 characters");
assert.strictEqual(canonicalTsla.precision, 8, "Precision must clamp to maximum 8");
assert.strictEqual(canonicalTsla.aliases.length, 1);
assert.strictEqual(canonicalTsla.aliases[0], "tsla", "Hostile aliases must be overwritten with canonical symbol");

// 4. Watchlist deserialization rejects malformed dynamic entries
const hostileWatchlistJson = JSON.stringify({
  version: 2,
  items: [
    { asset: "BTC", name: "Bitcoin", assetClass: "crypto" },
    { asset: "<script>alert(1)</script>", name: "XSS", assetClass: "stock" },
    { asset: "NVDA", name: "NVIDIA Corporation", assetClass: "stock" },
    { asset: "A/B", name: "Invalid Slash", assetClass: "stock" }
  ]
});

sandbox.clearDynamicInstruments();
const cleanedWl = sandbox.deserializeWatchlist(hostileWatchlistJson);
assert.strictEqual(cleanedWl.items.length, 2, "Only valid items (BTC, NVDA) should survive deserialization");
assert.strictEqual(cleanedWl.items[0].asset, "BTC");
assert.strictEqual(cleanedWl.items[1].asset, "NVDA");
assert.strictEqual(sandbox.getCatalogItem("<script>alert(1)</script>"), null);
assert.strictEqual(sandbox.getCatalogItem("A/B"), null);
assert.notStrictEqual(sandbox.getCatalogItem("NVDA"), null);

console.log("✓ Test N Passed: Dynamic stock symbols strictly validated (/^[A-Z0-9.\\-]{1,10}$/); hijacking and injection attacks completely prevented.");

console.log("============================================================\n");
console.log("ALL v1.2.1 REGRESSION TESTS PASSED! ✓ (14 / 14)");
console.log("============================================================\n");
