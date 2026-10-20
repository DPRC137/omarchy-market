import QtQuick
import Quickshell
import Quickshell.Io
import "../models/MarketModel.js" as MarketModel

Item {
  id: root
  property string providerId: ""
  property string status: "DISCONNECTED"
  property string lastError: ""
  property var targetAssets: []
  property bool active: false
  property double lastUpdateTimestamp: 0
  property double lastReconnectTimestamp: 0
  property alias client: http
  readonly property bool childProcessRunning: bridge.running
  signal quoteReceived(string asset, var quote)

  HttpClient { id: http; spacing: root.providerId === "coinbase" ? 350 : 100 }

  function updateSubscriptions(assets) {
    var next = assets.filter(function(asset) {
      var cat = MarketModel.getCatalogItem(asset)
      return cat && cat.assetClass === "crypto" && cat.providers[root.providerId]
    })
    if (JSON.stringify(next) === JSON.stringify(targetAssets)) return
    targetAssets = next
    active = next.length > 0
    http.cancel(function(r) { return r.kind !== "history" && r.asset && next.indexOf(r.asset) < 0; })
    if (!active) {
      restartTimer.stop()
      bridge.running = false
      http.cancel(function() { return true; })
      status = "DISCONNECTED"
      return
    }
    if (providerId !== "hyperliquid") {
      if (!bridge.running) bridge.running = true
      else bridge.write(JSON.stringify({ action: "set_subscriptions", symbols: targetAssets }) + "\n")
    }
    fetchSnapshot()
  }

  function accept(quote) {
    if (!active || !quote || targetAssets.indexOf(quote.asset) < 0) return
    lastUpdateTimestamp = Date.now()
    quoteReceived(quote.asset, quote)
  }
  function fetchMetaAndContexts() { fetchSnapshot() }
  function refresh(force) {
    if (!active) return
    // Repair the stream as well as fetching REST data. Throttle repeated clicks
    // and stale checks so an outage cannot cause a reconnect loop.
    if (providerId !== "hyperliquid" && Date.now() - lastReconnectTimestamp >= 30000) {
      lastReconnectTimestamp = Date.now()
      restartTimer.stop()
      if (bridge.running) bridge.write(JSON.stringify({ action: "reconnect" }) + "\n")
      else bridge.running = true
    }
    if (force) http.cancel(function(r) { return r.kind === "quote"; })
    fetchSnapshot()
  }
  function fetchSnapshot() {
    if (!active) return
    var req = { key: providerId + ":snapshot", kind: "quote", priority: 10 }
    if (providerId === "binance") {
      var symbols = targetAssets.map(function(a) { return MarketModel.getCatalogItem(a).providers.binance; })
      req.url = "https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(symbols))
    } else if (providerId === "hyperliquid") {
      req.url = "https://api.hyperliquid.xyz/info"
      req.body = JSON.stringify({ type: "metaAndAssetCtxs" })
    } else {
      targetAssets.forEach(function(asset) {
        var product = MarketModel.getCatalogItem(asset).providers.coinbase
        http.enqueue({ key: "coinbase:" + asset, asset: asset, kind: "quote", priority: 10, url: "https://api.exchange.coinbase.com/products/" + product + "/stats" }, function(result) {
          if (result.cancelled || !root.active || root.targetAssets.indexOf(asset) < 0) return
          if (result.error) { root.lastError = result.error; return }
          if (result.data) {
            root.lastError = ""
            var d = result.data
            accept(MarketModel.normalizeCoinbaseTicker({ product_id: product, price: d.last, open_24h: d.open, high_24h: d.high, low_24h: d.low, volume_24h: d.volume }, Date.now()))
          }
        })
      })
      return
    }
    http.enqueue(req, function(result) {
      if (!root.active || result.cancelled) return
      if (result.error) { lastError = result.error; if (providerId === "hyperliquid") status = "FAILED"; return }
      lastError = ""
      if (providerId === "binance" && Array.isArray(result.data)) result.data.forEach(function(raw) { accept(MarketModel.normalizeBinanceTicker(raw, Date.now())); })
      if (providerId === "hyperliquid") {
        status = "CONNECTED"
        MarketModel.normalizeHyperliquidMeta(result.data, targetAssets, Date.now()).forEach(accept)
      }
    })
  }
  Process {
    id: bridge
    command: ["node", decodeURIComponent(Qt.resolvedUrl("../scripts/ws_bridge.js").toString().replace("file://", "")), root.providerId, root.targetAssets.join(",")]
    stdout: SplitParser {
      splitMarker: "\n"
      onRead: function(line) {
        try {
          var msg = JSON.parse(line)
          if (!root.active) return
          if (msg.type === "status") root.status = msg.status
          if (msg.type === "ticker") root.accept(root.providerId === "binance" ? MarketModel.normalizeBinanceTicker(msg.raw, Date.now()) : MarketModel.normalizeCoinbaseTicker(msg.raw, Date.now()))
        } catch (e) {}
      }
    }
    onExited: { if (root.active) { root.status = "RECONNECTING"; restartTimer.restart() } }
  }
  Timer { id: restartTimer; interval: 10000; onTriggered: if (root.active && root.providerId !== "hyperliquid") bridge.running = true }
  Timer {
    interval: root.providerId === "hyperliquid" ? 8000 : 60000
    running: root.active
    repeat: true
    onTriggered: root.fetchSnapshot()
  }
  Component.onDestruction: { active = false; restartTimer.stop(); bridge.running = false }
}
