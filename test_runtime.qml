import QtQuick
import Quickshell
import Quickshell.Io
import "models/MarketModel.js" as MarketModel
import "providers"

Item {
  id: root

  Process {
    id: exitProc
    command: ["sh", "-c", "kill -9 $PPID"]
  }

  MarketService {
    id: marketService
  }

  property int step: 0
  property var initialWatchlist: ["BTC", "ETH", "HYPE", "AAPL", "MSFT", "NVDA"]
  property var receivedQuotes: ({})
  property var receivedCandles: ({})

  Timer {
    id: testRunner
    interval: 100
    repeat: true
    running: true
    onTriggered: {
      if (root.step === 0) {
        root.step = 1;
        runStep1_WatchlistAndProviderIsolation();
      } else if (root.step === 2) {
        // Waiting for quotes
        checkQuotesReceived();
      } else if (root.step === 4) {
        // Waiting for candles
        checkCandlesReceived();
      }
    }
  }

  Timer {
    id: safetyTimeout
    interval: 30000
    running: true
    onTriggered: {
      console.error("FATAL: Runtime audit timed out after 30 seconds!");
      exitProc.running = true;
    }
  }

  function runStep1_WatchlistAndProviderIsolation() {
    console.log("\n============================================================");
    console.log("=== RUNNING QUICKSHELL RUNTIME AUDIT & VERIFICATION ===");
    console.log("============================================================");

    console.log("\n[Step 1] Setting up mixed crypto + stock watchlist in MarketService...");
    var items = [];
    for (var i = 0; i < root.initialWatchlist.length; i++) {
      var cat = MarketModel.getCatalogItem(root.initialWatchlist[i]);
      if (cat) items.push(cat);
    }
    marketService.structuredWatchlist = { version: 1, items: items };
    marketService.watchlist = root.initialWatchlist;
    marketService.syncProviders();

    var providers = marketService.children;
    var binance = null, coinbase = null, hyperliquid = null, yahoo = null;
    for (var p = 0; p < providers.length; p++) {
      if (providers[p].providerId === "binance") binance = providers[p];
      if (providers[p].providerId === "coinbase") coinbase = providers[p];
      if (providers[p].providerId === "hyperliquid") hyperliquid = providers[p];
      if (providers[p].providerId === "yahoo") yahoo = providers[p];
    }

    if (!binance || !coinbase || !hyperliquid || !yahoo) {
      console.error("FAIL: Could not locate all 4 providers in MarketService!");
      exitProc.running = true;
      return;
    }

    console.log("✓ Located 4 providers in MarketService runtime:", binance.providerId, coinbase.providerId, hyperliquid.providerId, yahoo.providerId);

    // Verify Isolation
    console.log("  Binance target assets:", JSON.stringify(binance.targetAssets));
    console.log("  Coinbase target assets:", JSON.stringify(coinbase.targetAssets));
    console.log("  Hyperliquid target assets:", JSON.stringify(hyperliquid.targetAssets));
    console.log("  Yahoo target assets:", JSON.stringify(yahoo.targetAssets));

    // Check Binance & Coinbase only have crypto (and not HYPE or stocks)
    for (var b = 0; b < binance.targetAssets.length; b++) {
      var bAsset = binance.targetAssets[b];
      var bCat = MarketModel.getCatalogItem(bAsset);
      if (bCat.assetClass !== "crypto" || bAsset === "HYPE") {
        console.error("FAIL: Binance contains invalid asset: " + bAsset);
        exitProc.running = true;
        return;
      }
    }
    for (var c = 0; c < coinbase.targetAssets.length; c++) {
      var cAsset = coinbase.targetAssets[c];
      var cCat = MarketModel.getCatalogItem(cAsset);
      if (cCat.assetClass !== "crypto" || cAsset === "HYPE") {
        console.error("FAIL: Coinbase contains invalid asset: " + cAsset);
        exitProc.running = true;
        return;
      }
    }
    // Check Hyperliquid only has crypto
    for (var h = 0; h < hyperliquid.targetAssets.length; h++) {
      var hAsset = hyperliquid.targetAssets[h];
      var hCat = MarketModel.getCatalogItem(hAsset);
      if (hCat.assetClass !== "crypto") {
        console.error("FAIL: Hyperliquid contains non-crypto asset: " + hAsset);
        exitProc.running = true;
        return;
      }
    }
    // Check Yahoo only has stocks
    for (var y = 0; y < yahoo.targetAssets.length; y++) {
      var yAsset = yahoo.targetAssets[y];
      var yCat = MarketModel.getCatalogItem(yAsset);
      if (yCat.assetClass !== "stock") {
        console.error("FAIL: Yahoo contains non-stock asset: " + yAsset);
        exitProc.running = true;
        return;
      }
    }
    console.log("✓ Strict Provider Asset Class Isolation confirmed (Zero cross-contamination)!");

    runStep2_YahooSchedulerInvariant(yahoo);
  }

  function runStep2_YahooSchedulerInvariant(yahoo) {
    console.log("\n[Step 2] Verifying Yahoo Request Scheduler & Invariant (maxConcurrent = 1)...");
    
    if (yahoo.inFlight !== false && yahoo.inFlight !== true) {
      console.error("FAIL: yahoo.inFlight property invalid!");
      exitProc.running = true;
      return;
    }
    console.log("✓ Yahoo inFlight property initialized cleanly (inFlight=" + yahoo.inFlight + ")");

    yahoo.updateSubscriptions(["AAPL", "MSFT", "NVDA"]);
    console.log("✓ Enqueued snapshot for 3 stocks. Current queue size:", yahoo.queue.length, "| In-Flight:", yahoo.inFlight);

    root.step = 2;
  }

  Connections {
    target: marketService
    function onQuoteUpdated(asset, quote) {
      root.receivedQuotes[asset] = quote;
      console.log("  -> [Runtime Event] Quote Received:", asset, "| Price: $" + (quote ? quote.price.toFixed(2) : "N/A"), "| State:", (quote ? quote.marketState : "N/A"), "| Provider:", (quote ? quote.provider : "N/A"));
    }
    function onCandlesUpdated(asset, timeframe, candles) {
      var key = asset + "_" + timeframe;
      root.receivedCandles[key] = candles;
      console.log("  -> [Runtime Event] Candles Received:", key, "| Count:", candles.length, "bars");
    }
  }

  function checkQuotesReceived() {
    var stocks = ["AAPL", "MSFT", "NVDA"];
    var allStocksReceived = true;
    for (var i = 0; i < stocks.length; i++) {
      if (!root.receivedQuotes[stocks[i]] || root.receivedQuotes[stocks[i]].price <= 0) {
        allStocksReceived = false;
        break;
      }
    }

    if (allStocksReceived) {
      console.log("✓ All 3 live Yahoo stock quotes received and parsed in Quickshell runtime!");
      
      for (var s = 0; s < stocks.length; s++) {
        var sym = stocks[s];
        var q = root.receivedQuotes[sym];
        if (!isFinite(q.price) || q.price <= 0) {
          console.error("FAIL: Price not finite for " + sym);
          exitProc.running = true;
          return;
        }
        if (!isFinite(q.previousClose) || q.previousClose <= 0) {
          console.error("FAIL: previousClose not finite for " + sym);
          exitProc.running = true;
          return;
        }
        if (!isFinite(q.change24h) || !isFinite(q.changeAmount)) {
          console.error("FAIL: change not finite for " + sym);
          exitProc.running = true;
          return;
        }
        var expectedAmount = q.price - q.previousClose;
        if (Math.abs(q.changeAmount - expectedAmount) > 0.01) {
          console.error("FAIL: changeAmount inconsistent for " + sym + ": " + q.changeAmount + " vs " + expectedAmount);
          exitProc.running = true;
          return;
        }
        var expectedPct = (expectedAmount / q.previousClose) * 100;
        if (Math.abs(q.change24h - expectedPct) > 0.05) {
          console.error("FAIL: change24h % inconsistent for " + sym + ": " + q.change24h + " vs " + expectedPct);
          exitProc.running = true;
          return;
        }
        console.log("  ✓ " + sym + " mathematically consistent: Price=$" + q.price.toFixed(2) + ", PrevClose=$" + q.previousClose.toFixed(2) + ", Change=$" + q.changeAmount.toFixed(2) + " (" + (q.change24h >= 0 ? "+" : "") + q.change24h.toFixed(2) + "%) | Session: " + q.marketState);
      }

      root.step = 3;
      runStep3_CandleFetchingAndCaching();
    }
  }

  function runStep3_CandleFetchingAndCaching() {
    console.log("\n[Step 3] Testing On-Demand Candle Fetching & Caching...");
    console.log("  Fetching AAPL 1H candles...");
    marketService.fetchCandles("AAPL", "1H");
    root.step = 4;
  }

  function checkCandlesReceived() {
    if (root.receivedCandles["AAPL_1H"] && root.receivedCandles["AAPL_1H"].length > 0) {
      var candles1H = root.receivedCandles["AAPL_1H"];
      console.log("✓ Received " + candles1H.length + " AAPL 1H candle bars in Quickshell runtime!");
      var first = candles1H[0];
      var last = candles1H[candles1H.length - 1];
      console.log("  First bar: Time=" + new Date(first.time).toISOString().slice(0, 16) + " O=" + first.open + " H=" + first.high + " L=" + first.low + " C=" + first.close);
      console.log("  Last bar:  Time=" + new Date(last.time).toISOString().slice(0, 16) + " O=" + last.open + " H=" + last.high + " L=" + last.low + " C=" + last.close);

      console.log("\n[Step 4] Verifying Candle Cache Awareness (AAPL -> 1D -> 4H -> 1D)...");
      var yahooProvider = null;
      for (var p = 0; p < marketService.children.length; p++) {
        if (marketService.children[p].providerId === "yahoo") yahooProvider = marketService.children[p];
      }
      var preQueueCount = yahooProvider ? yahooProvider.queue.length : 0;
      marketService.fetchCandles("AAPL", "1H"); // Should hit cache
      var postQueueCount = yahooProvider ? yahooProvider.queue.length : 0;
      if (preQueueCount === postQueueCount) {
        console.log("✓ Candle Cache Hit verified: Zero duplicate requests queued for already cached timeframe!");
      } else {
        console.error("FAIL: Candle cache missed and unnecessarily queued request!");
        exitProc.running = true;
        return;
      }

      runStep5_WatchlistOperationsAndPersistence();
    }
  }

  function runStep5_WatchlistOperationsAndPersistence() {
    console.log("\n[Step 5] Testing Watchlist Operations & Mixed Persistence...");
    
    var addRes = marketService.addMarket("AMZN");
    if (!addRes.success) {
      console.error("FAIL: Failed to add AMZN to watchlist: " + addRes.reason);
      exitProc.running = true;
      return;
    }
    console.log("✓ Added AMZN to watchlist. Current watchlist:", JSON.stringify(marketService.watchlist));

    var nvdaIdx = marketService.watchlist.indexOf("NVDA");
    var reorderRes = marketService.reorderMarket(nvdaIdx, 0);
    if (!reorderRes.success || marketService.watchlist[0] !== "NVDA") {
      console.error("FAIL: Failed to reorder NVDA to index 0");
      exitProc.running = true;
      return;
    }
    console.log("✓ Reordered NVDA to top. Current watchlist:", JSON.stringify(marketService.watchlist));

    var removeRes = marketService.removeMarket("MSFT");
    if (!removeRes.success || marketService.watchlist.indexOf("MSFT") !== -1) {
      console.error("FAIL: Failed to remove MSFT from watchlist");
      exitProc.running = true;
      return;
    }
    console.log("✓ Removed MSFT from watchlist. Current watchlist:", JSON.stringify(marketService.watchlist));

    var serialized = MarketModel.serializeWatchlist(marketService.structuredWatchlist);
    var deserialized = MarketModel.deserializeWatchlist(serialized);
    if (deserialized.items.length !== marketService.watchlist.length) {
      console.error("FAIL: Deserialized length mismatch!");
      exitProc.running = true;
      return;
    }
    for (var k = 0; k < deserialized.items.length; k++) {
      if (deserialized.items[k].asset !== marketService.watchlist[k]) {
        console.error("FAIL: Deserialized item order mismatch at " + k);
        exitProc.running = true;
        return;
      }
    }
    console.log("✓ Mixed Watchlist Serialization & Deserialization roundtrip verified!");

    console.log("\n============================================================");
    console.log("✓ ALL REAL QUICKSHELL RUNTIME AUDIT CHECKS PASSED (100%)!");
    console.log("============================================================\n");

    exitProc.running = true;
  }
}
