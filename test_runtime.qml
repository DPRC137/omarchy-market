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
  property string baseUrl: Quickshell.env("MARKET_TEST_URL")
  function check(condition, message) {
    if (!condition) { failed = true; console.error("NATIVE_FAIL", message) }
  }
  function done() {
    finished++
    if (finished === 5) {
      check(!service.provider("binance").childProcessRunning, "Binance process remained after stock-only migration")
      check(!service.provider("coinbase").childProcessRunning, "Coinbase process remained after stock-only migration")
      if (!failed) console.log("NATIVE_PASS: QML service, stock-only cleanup, ordered undo, settings, search errors, HTTP parse/failure/Qt timeout/cancellation")
      Qt.quit()
    }
  }
  MarketService { id: service }
  HttpClient { id: http }
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
      // A failed production search must call back with an explicit error.
      // Replace only the transport, retaining the actual provider and scheduler.
      var yahooClient = service.provider("yahoo").client
      yahooClient.scheduler = Queue.create(function(request, callback) {
        return yahooClient.start({ url: root.baseUrl + "/fail", maxBytes: 131072 }, callback)
      }, Date.now, 1200, 24)
      service.searchYahooMarkets("apple", function(results, error) { root.check(results.length === 0 && error !== "", "search failure hidden as no results"); root.done() })
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
