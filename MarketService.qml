import QtQuick
import QtCore
import "models/MarketModel.js" as MarketModel
import "models/History.js" as History
import "providers"

Item {
  id: root
  property var shell: null
  property string omarchyPath: ""
  property var manifest: null
  property var barWidgetRegistry: null
  property var pluginRegistry: null
  property var structuredWatchlist: MarketModel.createDefaultWatchlist()
  property var watchlist: ["BTC", "ETH", "SOL", "HYPE"]
  property int updateRevision: 0
  property double now: Date.now()
  property var quotesByAssetProvider: ({})
  property var history: null
  property string visibleAsset: ""
  property string visibleRange: "1D"
  property var removedItem: null
  property int removedIndex: -1
  property alias pinnedAsset: pluginSettings.pinnedAsset
  property alias rotationEnabled: pluginSettings.rotationEnabled
  signal quoteUpdated(string asset, var quote)
  signal candlesUpdated(string asset, string timeframe, var candles)

  Settings {
    id: pluginSettings
    category: "io.github.dpr.omarchy-market"
    // Keep the host's established QSettings store when it has an identity.
    // Some Quickshell hosts omit it entirely; those require an explicit file.
    location: StandardPaths.writableLocation(StandardPaths.GenericConfigLocation) + "/" + (Qt.application.organization || "Unknown Organization") + "/" + (Qt.application.name || "quickshell") + ".conf"
    property string watchlistJson: ""
    property string pinnedAsset: ""
    property bool rotationEnabled: false
  }
  function persist(watchlistObject) {
    MarketModel.clearDynamicInstruments()
    watchlistObject.items.forEach(function(item) { if (item.assetClass === "stock" && !MarketModel.CATALOG_BY_ASSET[item.asset]) MarketModel.registerDynamicInstrument(item) })
    structuredWatchlist = watchlistObject
    watchlist = watchlistObject.items.map(function(it) { return it.asset; })
    var retained = {}
    watchlist.forEach(function(asset) { if (root.quotesByAssetProvider[asset]) retained[asset] = root.quotesByAssetProvider[asset]; })
    quotesByAssetProvider = retained
    pluginSettings.watchlistJson = MarketModel.serializeWatchlist(watchlistObject)
    syncProviders()
    updateRevision++
  }
  function addMarket(item) {
    var result = MarketModel.addWatchlistMarket(structuredWatchlist, item)
    if (result.success) persist(result.watchlist)
    return result
  }
  function removeMarket(asset) {
    var index = watchlist.indexOf(asset)
    var result = MarketModel.removeWatchlistMarket(structuredWatchlist, asset)
    if (result.success) {
      removedItem = structuredWatchlist.items[index]; removedIndex = index
      persist(result.watchlist)
      if (visibleAsset === asset) setVisibleChart("", visibleRange)
      var next = Object.assign({}, quotesByAssetProvider); delete next[asset]; quotesByAssetProvider = next
    }
    return result
  }
  function undoRemoval() {
    if (!removedItem) return
    var result = MarketModel.addWatchlistMarket(structuredWatchlist, removedItem)
    if (result.success) {
      result = MarketModel.reorderWatchlistMarket(result.watchlist, result.watchlist.items.length - 1, Math.min(removedIndex, result.watchlist.items.length - 1))
      persist(result.watchlist); removedItem = null
    }
  }
  function reorderMarket(from, to) {
    var result = MarketModel.reorderWatchlistMarket(structuredWatchlist, from, to)
    if (result.success) persist(result.watchlist)
    return result
  }
  function searchMarkets(query) { return MarketModel.searchCatalog(query) }
  function isInWatchlist(asset) { return watchlist.indexOf(asset) >= 0 }
  function syncProviders() {
    binance.updateSubscriptions(watchlist)
    coinbase.updateSubscriptions(watchlist)
    hyperliquid.updateSubscriptions(watchlist)
    yahoo.updateSubscriptions(watchlist)
  }
  BinanceProvider { id: binance; onQuoteReceived: function(asset, quote) { root.handleProviderQuote("binance", asset, quote) } }
  CoinbaseProvider { id: coinbase; onQuoteReceived: function(asset, quote) { root.handleProviderQuote("coinbase", asset, quote) } }
  HyperliquidProvider { id: hyperliquid; onQuoteReceived: function(asset, quote) { root.handleProviderQuote("hyperliquid", asset, quote) } }
  YahooProvider { id: yahoo; onQuoteReceived: function(asset, quote) { root.handleProviderQuote("yahoo", asset, quote) } }

  function provider(id) { return id === "yahoo" ? yahoo : id === "binance" ? binance : id === "coinbase" ? coinbase : hyperliquid }
  function handleProviderQuote(id, asset, quote) {
    if (!isInWatchlist(asset) || quote.provider !== id) return
    var previous = getProviderQuote(asset, id)
    if (previous && quote.providerTimestamp < previous.providerTimestamp) return
    var next = Object.assign({}, quotesByAssetProvider)
    next[asset] = Object.assign({}, next[asset] || {})
    next[asset][id] = quote
    quotesByAssetProvider = next
    if (id === "yahoo" && !MarketModel.CATALOG_BY_ASSET[asset]) {
      var item = MarketModel.getCatalogItem(asset)
      if (item && item.currency !== quote.currency) {
        MarketModel.registerDynamicInstrument(Object.assign({}, item, { currency: quote.currency }))
        structuredWatchlist = { version: MarketModel.SCHEMA_VERSION, items: structuredWatchlist.items.map(function(it) { return it.asset === asset ? Object.assign({}, it, { currency: quote.currency, instrument: quote.instrument }) : it; }) }
        pluginSettings.watchlistJson = MarketModel.serializeWatchlist(structuredWatchlist)
      }
    }
    batch.restart()
    quoteUpdated(asset, getQuote(asset))
  }
  function getQuote(asset, id) {
    if (id && id !== "aggregate") return getProviderQuote(asset, id) || MarketModel.createEmptyQuote(asset, id)
    return MarketModel.calculateReferenceQuote(asset, quotesByAssetProvider[asset], now)
  }
  function getProviderQuote(asset, id) {
    var q = quotesByAssetProvider[asset]
    return q && q[id] ? MarketModel.decorateQuote(q[id], now) : null
  }
  function getProviderError(id) { return provider(id).lastError }
  function getProviderStatus(id) { return provider(id).status }
  function setVisibleChart(asset, range) {
    visibleAsset = asset; visibleRange = range || "1D"
    if (!history) return
    if (!asset) { history.clear(); return }
    fetchCandles(asset, visibleRange)
  }
  function fetchCandles(asset, range, force) {
    if (!history || !isInWatchlist(asset)) return
    var q = getQuote(asset)
    history.select(asset, MarketModel.selectedProvider(asset), range || "1D", q.currency, !!force)
  }
  function getCandles(asset, range) {
    if (!history || !history.visible || history.visible.asset !== asset || history.visible.range !== range) return []
    var entry = history.entry()
    return entry ? entry.points : []
  }
  function fetchQuote(asset) { if (MarketModel.selectedProvider(asset) === "yahoo") yahoo.fetchQuote(asset) }
  function searchYahooMarkets(query, callback) { yahoo.searchSymbols(query, callback) }
  function refresh() {
    binance.fetchSnapshot(); coinbase.fetchSnapshot(); hyperliquid.fetchSnapshot(); yahoo.fetchSnapshot()
    if (visibleAsset) fetchCandles(visibleAsset, visibleRange, true)
  }
  Timer { id: batch; interval: 100; onTriggered: root.updateRevision++ }
  Timer {
    interval: 1000; running: true; repeat: true
    onTriggered: { root.now = Date.now(); root.updateRevision++; if (root.history) root.history.expire() }
  }
  Timer {
    interval: 60000; running: root.visibleAsset !== ""; repeat: true
    onTriggered: root.fetchCandles(root.visibleAsset, root.visibleRange)
  }
  Component.onCompleted: {
    history = History.create({
      enqueue: function(request, callback) { return root.provider(request.provider).client.enqueue(request, callback); },
      cancel: function(predicate) { [binance, coinbase, hyperliquid, yahoo].forEach(function(p) { p.client.cancel(function(r) { return r.kind === "history" && predicate(r); }); }); }
    }, function() {
      root.updateRevision++
      if (root.history && root.history.visible) root.candlesUpdated(root.history.visible.asset, root.history.visible.range, root.getCandles(root.history.visible.asset, root.history.visible.range))
    }, Date.now)
    Qt.callLater(function() { root.persist(MarketModel.deserializeWatchlist(pluginSettings.watchlistJson)) })
  }
  Component.onDestruction: if (history) history.clear()
}
