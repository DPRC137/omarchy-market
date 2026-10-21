import QtQuick
import Quickshell
import "models/MarketModel.js" as Model
import "models/RequestQueue.js" as Queue
import "providers"

// Deterministic native integration harness. Run via tests/run_native.js so that
// settings, runtime directories and HTTP responses are isolated from the user.
ShellRoot {
  id: root
  property int finished: 0
  property bool failed: false
  property bool sessionChecked: false
  property string baseUrl: Quickshell.env("MARKET_TEST_URL")
  function check(condition, message) {
    if (!condition) { failed = true; console.error("NATIVE_FAIL", message) }
  }
  function checkQuoteRefresh(provider, assets) {
    var client = provider.client
    client.cancel(function() { return true; })
    if (client.scheduler) client.scheduler.stop()
    var started = [], cancelled = false
    var clock = Date.now()
    if (provider.providerId === "yahoo") {
      service.handleProviderQuote("yahoo", assets[0], Model.normalizeYahooChart({ chart: { result: [{ meta: { symbol: assets[0], currency: "USD", regularMarketPrice: 100, regularMarketTime: Math.floor(clock / 1000) - 1000 } }] } }, clock - 700000))
      root.check(service.getProviderQuote(assets[0], "yahoo").freshness === "STALE", "Refresh regression did not start with a stale quote")
    }
    client.scheduler = Queue.create(function(request, callback) {
      started.push({ request: request, done: callback })
      return function() {}
    }, function() { return clock; }, 100, 24)
    client.enqueue({ key: "blocked-quote", kind: "quote" }, function(result) { cancelled = result.cancelled })
    client.enqueue({ key: "keep-history", kind: "history", priority: 100 }, function() {})
    client.enqueue({ key: "keep-search", kind: "search", priority: 80 }, function() {})
    provider.refresh(true)
    root.check(cancelled, "Refresh failed to replace a blocked quote")
    root.check(service.refreshing, "Refresh did not expose request activity")
    root.check(client.scheduler.pending.some(function(task) { return task.request.key === "keep-history" }), "Quote refresh cancelled history")
    root.check(client.scheduler.pending.some(function(task) { return task.request.key === "keep-search" }), "Quote refresh cancelled search")
    root.check(client.scheduler.pending.filter(function(task) { return task.request.kind === "quote" }).length === assets.length, "Refresh failed to schedule watched quotes")
    // Release higher priority work, then deliver a real provider response.
    client.cancel(function(r) { return r.kind !== "quote"; })
    clock += 100; client.scheduler.pump()
    var job = started[started.length - 1]
    if (provider.providerId === "yahoo") {
      job.done({ data: { chart: { result: [{ meta: { symbol: job.request.asset, currency: "USD", regularMarketPrice: 123, regularMarketTime: Math.floor(Date.now() / 1000) } }] } } })
      root.check(service.getProviderQuote(job.request.asset, "yahoo").price === 123, "Refreshed quote did not reach the service")
      root.check(service.getProviderQuote(job.request.asset, "yahoo").freshness === "CURRENT", "Refresh left the quote stale")
    }
    client.scheduler.stop()
  }
  function done() {
    finished++
    if (finished === 8) {
      check(!service.provider("binance").childProcessRunning, "Binance process remained after stock-only migration")
      check(!service.provider("coinbase").childProcessRunning, "Coinbase process remained after stock-only migration")
      if (!failed) console.log("NATIVE_PASS: QML service, forced quote refresh and freshness recovery, stock-only cleanup, ordered undo, settings, search errors, HTTP parse/failure/Qt timeout/cancellation, streamed search/data ceilings, empty-session recovery")
      Qt.quit()
    }
  }
  MarketService { id: service }
  HttpClient { id: http }
  HttpClient { id: boundedData }
  HttpClient { id: boundedSearch }
  function checkBounded(client, name, limit) {
    var request = { key: name, url: baseUrl + "/stream/" + name }
    if (limit) request.maxBytes = limit
    client.enqueue(request, function(result) {
      root.check(result.error === "Response too large" && !result.data, "Unbounded streamed payload reached parsing: " + name)
      root.done()
    })
  }
  Connections {
    target: service
    function onCandlesUpdated(asset, range, candles) {
      if (asset !== "TSLA" || candles.length === 0 || root.sessionChecked) return
      root.sessionChecked = true
      root.check(candles.length === 79 && service.history.entry().sessionDate === "2026-10-16", "Native empty-session recovery did not retain the actual last session")
      service.removeMarket("TSLA")
      root.done()
    }
  }
  Timer {
    interval: 250; running: true
    onTriggered: {
      var phase = Quickshell.env("MARKET_TEST_PHASE")
      if (phase === "restore") {
        root.check(JSON.stringify(service.watchlist) === '["MSFT","AAPL"]', "QSettings did not retain order across processes")
        root.check(service.pinnedAsset === "MSFT" && service.rotationEnabled, "pin/rotation did not persist")
        if (!root.failed) console.log("NATIVE_RESTORE_PASS")
        Qt.quit(); return
      }
      root.check(JSON.stringify(service.watchlist) === '["ETH","BTC","AAPL"]', "Legacy General-group watchlist was not preserved")
      service.persist(Model.deserializeWatchlist('["AAPL","MSFT"]'))
      service.provider("yahoo").client.cancel(function() { return true; })
      root.check(!service.provider("binance").active && !service.provider("hyperliquid").active && !service.provider("coinbase").active, "stock-only watchlist started crypto providers")
      service.removeMarket("AAPL"); service.undoRemoval()
      root.check(JSON.stringify(service.watchlist) === '["AAPL","MSFT"]', "Undo changed ordering")
      service.reorderMarket(1, 0)
      service.pinnedAsset = "MSFT"; service.rotationEnabled = true
      root.checkQuoteRefresh(service.provider("yahoo"), service.watchlist)
      var hyper = service.provider("hyperliquid")
      hyper.targetAssets = ["BTC"]; hyper.active = true
      root.checkQuoteRefresh(hyper, ["BTC"])
      hyper.active = false; hyper.targetAssets = []
      // A failed production search must call back with an explicit error.
      // Replace only the transport, retaining the actual provider and scheduler.
      service.addMarket("TSLA")
      var yahooClient = service.provider("yahoo").client
      yahooClient.cancel(function() { return true; })
      yahooClient.scheduler.stop()
      yahooClient.scheduler = Queue.create(function(request, callback) {
        var endpoint = request.kind === "history" ? request.httpRange === "1d" ? "/history-empty" : "/history-session" : "/fail"
        return yahooClient.start({ url: root.baseUrl + endpoint, maxBytes: 131072 }, callback)
      }, Date.now, 1200, 24)
      service.fetchCandles("TSLA", "1D", true)
      service.searchYahooMarkets("apple", function(results, error) { root.check(results.length === 0 && error !== "", "search failure hidden as no results"); root.done() })
      root.checkBounded(boundedData, "data", 0)
      root.checkBounded(boundedSearch, "search", 131072)
      http.enqueue({ key: "ok", url: root.baseUrl + "/ok" }, function(result) { root.check(result.data && result.data.value === 42, "native JSON response"); root.done() })
      http.enqueue({ key: "json", url: root.baseUrl + "/invalid" }, function(result) { root.check(!!result.error, "invalid JSON accepted"); root.done() })
      http.enqueue({ key: "large", url: root.baseUrl + "/large", maxBytes: 20 }, function(result) { root.check(!!result.error, "size bound ignored"); root.done() })
      http.enqueue({ key: "hang", url: root.baseUrl + "/hang", timeout: 100 }, function(result) { root.check(result.error === "Request timed out", "Qt timer did not time out request"); root.done() })
      http.enqueue({ key: "cancel", url: root.baseUrl + "/ok" }, function(result) { root.check(result.cancelled, "cancellation did not finalize"); })
      http.cancel(function(request) { return request.key === "cancel"; })
    }
  }
  Timer { interval: 25000; running: true; onTriggered: { console.error("NATIVE_FAIL: harness deadline"); Qt.quit() } }
}
