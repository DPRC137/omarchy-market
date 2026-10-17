import QtQuick
import "../models/MarketModel.js" as MarketModel

Item {
  id: root
  readonly property string providerId: "yahoo"
  property string status: "DISCONNECTED"
  property string lastError: ""
  property var targetAssets: []
  property bool active: false
  property var quotes: ({})
  property alias client: http
  property int searchGeneration: 0
  signal quoteReceived(string asset, var quote)

  HttpClient { id: http; spacing: 1200 }
  function updateSubscriptions(assets) {
    var next = assets.filter(function(a) { var c = MarketModel.getCatalogItem(a); return c && c.assetClass === "stock"; })
    if (JSON.stringify(next) === JSON.stringify(targetAssets)) return
    var retained = {}
    next.forEach(function(asset) { if (root.quotes[asset]) retained[asset] = root.quotes[asset]; })
    quotes = retained
    targetAssets = next
    active = next.length > 0
    http.cancel(function(r) { return r.kind === "quote" && next.indexOf(r.asset) < 0; })
    if (active) fetchSnapshot()
    else status = "DISCONNECTED"
  }
  function fetchQuote(asset) {
    if (!active || targetAssets.indexOf(asset) < 0) return
    http.enqueue({ key: "quote:" + asset, kind: "quote", asset: asset, priority: 10,
      url: "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(asset) + "?interval=1m&range=1d&includePrePost=false"
    }, function(result) {
      if (result.cancelled || targetAssets.indexOf(asset) < 0) return
      if (result.error) { status = "FAILED"; lastError = result.error; return }
      var quote = MarketModel.normalizeYahooChart(result.data, Date.now())
      if (!quote || quote.asset !== asset) { status = "FAILED"; lastError = "Unsupported currency, invalid instrument or unavailable quote"; return }
      status = "CONNECTED"; lastError = ""
      var next = Object.assign({}, quotes); next[asset] = quote; quotes = next
      quoteReceived(asset, quote)
    })
  }
  function fetchSnapshot() { targetAssets.forEach(fetchQuote) }
  function searchSymbols(query, callback) {
    var generation = ++searchGeneration
    http.cancel(function(r) { return r.kind === "search"; })
    if (!query.trim()) { callback([], ""); return }
    http.enqueue({ key: "search:" + generation, kind: "search", priority: 80, maxBytes: 131072,
      url: "https://query1.finance.yahoo.com/v1/finance/search?q=" + encodeURIComponent(query.trim()) + "&quotesCount=8&newsCount=0"
    }, function(result) {
      if (generation !== searchGeneration || result.cancelled) return
      if (result.error) { callback([], result.error); return }
      var rows = result.data && result.data.quotes
      if (!Array.isArray(rows)) { callback([], "Invalid search response"); return }
      var items = rows.filter(function(r) { return r && (r.quoteType === "EQUITY" || r.quoteType === "ETF"); }).map(function(r) {
        // Search often omits currency. Keep it unknown until chart metadata
        // resolves the units; unknown prices are never displayed as dollars.
        return MarketModel.canonicalizeDynamicStock({ asset: r.symbol, name: r.shortname || r.longname, exchange: r.exchDisp || r.exchange, currency: r.currency });
      }).filter(function(r) { return r !== null; }).slice(0, 8)
      callback(items, "")
    })
  }
  Timer {
    interval: {
      for (var i = 0; i < root.targetAssets.length; i++) {
        var q = root.quotes[root.targetAssets[i]]
        if (!q || MarketModel.sessionAt(q.tradingPeriods, Date.now()) !== "closed") return 60000
      }
      return 300000
    }
    running: root.active
    repeat: true
    onTriggered: root.fetchSnapshot()
  }
}
