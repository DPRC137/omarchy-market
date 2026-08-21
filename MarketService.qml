import QtQuick
import QtCore
import Quickshell
import "models/MarketModel.js" as MarketModel
import "providers"

Item {
  id: root

  // Properties injected by shell.qml when mounted as a service
  property var shell: null
  property string omarchyPath: ""
  property var manifest: null
  property var barWidgetRegistry: null
  property var pluginRegistry: null

  // Watchlist & Settings
  property var structuredWatchlist: MarketModel.createDefaultWatchlist()
  property var watchlist: ["BTC", "ETH", "SOL", "HYPE"]
  property string preferredProvider: "aggregate" // aggregate, binance, coinbase, hyperliquid
  property int updateRevision: 0

  // Quote Stores: quotes[asset][provider]
  property var quotesByAssetProvider: ({})
  property var referenceQuotes: ({})
  property var candleStore: ({})

  signal quoteUpdated(string asset, var quote)
  signal candlesUpdated(string asset, string timeframe, var candles)

  Settings {
    id: pluginSettings
    category: "io.github.dpr.omarchy-market"
    property string watchlistJson: ""
  }

  function loadWatchlist() {
    var loaded = MarketModel.deserializeWatchlist(pluginSettings.watchlistJson)
    structuredWatchlist = loaded
    watchlist = loaded.items.map(function(it) { return it.asset })
    syncProviders()
  }

  function saveWatchlist() {
    pluginSettings.watchlistJson = MarketModel.serializeWatchlist(structuredWatchlist)
  }

  function addMarket(assetOrQuery) {
    var res = MarketModel.addWatchlistMarket(structuredWatchlist, assetOrQuery)
    if (res.success) {
      structuredWatchlist = res.watchlist
      watchlist = res.watchlist.items.map(function(it) { return it.asset })
      saveWatchlist()
      syncProviders()
      root.updateRevision++
      fetchCandles(watchlist[watchlist.length - 1], "1H")
    }
    return res
  }

  function removeMarket(asset) {
    var res = MarketModel.removeWatchlistMarket(structuredWatchlist, asset)
    if (res.success) {
      structuredWatchlist = res.watchlist
      watchlist = res.watchlist.items.map(function(it) { return it.asset })
      saveWatchlist()
      syncProviders()
      root.updateRevision++
    }
    return res
  }

  function reorderMarket(fromIndex, toIndex) {
    var res = MarketModel.reorderWatchlistMarket(structuredWatchlist, fromIndex, toIndex)
    if (res.success) {
      structuredWatchlist = res.watchlist
      watchlist = res.watchlist.items.map(function(it) { return it.asset })
      saveWatchlist()
      root.updateRevision++
    }
    return res
  }

  function searchMarkets(query) {
    return MarketModel.searchCatalog(query)
  }

  function isInWatchlist(asset) {
    if (!asset) return false
    var upper = String(asset).toUpperCase()
    return root.watchlist.indexOf(upper) !== -1
  }

  function syncProviders() {
    if (binanceProvider) binanceProvider.updateSubscriptions(root.watchlist)
    if (coinbaseProvider) coinbaseProvider.updateSubscriptions(root.watchlist)
    if (hyperliquidProvider) hyperliquidProvider.updateSubscriptions(root.watchlist)
  }

  // Provider instances
  BinanceProvider {
    id: binanceProvider
    targetAssets: root.watchlist
    onQuoteReceived: function(asset, quote) { root.handleProviderQuote("binance", asset, quote) }
    onCandlesReceived: function(asset, timeframe, list) { root.handleCandles("binance", asset, timeframe, list) }
  }

  CoinbaseProvider {
    id: coinbaseProvider
    targetAssets: root.watchlist
    onQuoteReceived: function(asset, quote) { root.handleProviderQuote("coinbase", asset, quote) }
    onCandlesReceived: function(asset, timeframe, list) { root.handleCandles("coinbase", asset, timeframe, list) }
  }

  HyperliquidProvider {
    id: hyperliquidProvider
    targetAssets: root.watchlist
    onQuoteReceived: function(asset, quote) { root.handleProviderQuote("hyperliquid", asset, quote) }
    onCandlesReceived: function(asset, timeframe, list) { root.handleCandles("hyperliquid", asset, timeframe, list) }
  }

  function handleProviderQuote(providerId, asset, quote) {
    if (!asset || !quote) return

    var byAsset = Object.assign({}, quotesByAssetProvider)
    if (!byAsset[asset]) byAsset[asset] = {}
    byAsset[asset][providerId] = quote
    quotesByAssetProvider = byAsset

    // Recompute reference quote for this asset
    var ref = MarketModel.calculateReferenceQuote(asset, byAsset[asset], Date.now())
    var byRef = Object.assign({}, referenceQuotes)
    byRef[asset] = ref
    referenceQuotes = byRef

    // Batch UI change notification
    batchUpdateTimer.restart()
    root.quoteUpdated(asset, getQuote(asset, preferredProvider))
  }

  function handleCandles(providerId, asset, timeframe, list) {
    var cMap = Object.assign({}, candleStore)
    cMap[asset + "_" + timeframe] = list
    candleStore = cMap
    root.candlesUpdated(asset, timeframe, list)
  }

  Timer {
    id: batchUpdateTimer
    interval: 100
    repeat: false
    onTriggered: {
      root.updateRevision++
    }
  }

  function getQuote(asset, provider) {
    var targetProvider = provider || preferredProvider || "aggregate"
    if (targetProvider === "aggregate") {
      return referenceQuotes[asset] || MarketModel.createEmptyQuote(asset, "aggregate")
    }
    var byAsset = quotesByAssetProvider[asset]
    if (byAsset && byAsset[targetProvider]) {
      return byAsset[targetProvider]
    }
    return referenceQuotes[asset] || MarketModel.createEmptyQuote(asset, targetProvider)
  }

  function getProviderQuote(asset, providerId) {
    var byAsset = quotesByAssetProvider[asset]
    return (byAsset && byAsset[providerId]) ? byAsset[providerId] : null
  }

  function getProviderStatus(providerId) {
    if (providerId === "binance") return binanceProvider.status
    if (providerId === "coinbase") return coinbaseProvider.status
    if (providerId === "hyperliquid") return hyperliquidProvider.status
    return "UNKNOWN"
  }

  function getCandles(asset, timeframe) {
    var key = asset + "_" + (timeframe || "1H")
    return candleStore[key] || []
  }

  function fetchCandles(asset, timeframe) {
    var tf = timeframe || "1H"
    var cat = MarketModel.getCatalogItem(asset)
    var isPerpOnly = (asset === "HYPE" || (cat && cat.instrument && cat.instrument.indexOf("PERP") !== -1))
    if (isPerpOnly) {
      hyperliquidProvider.fetchCandles(asset, tf)
    } else {
      binanceProvider.fetchCandles(asset, tf)
      coinbaseProvider.fetchCandles(asset, tf)
      hyperliquidProvider.fetchCandles(asset, tf)
    }
  }

  function refresh() {
    binanceProvider.fetchSnapshot()
    coinbaseProvider.fetchSnapshot()
    hyperliquidProvider.fetchMetaAndContexts()
  }

  Component.onCompleted: {
    console.log("MarketService initialized. Starting crypto market feeds...")
    loadWatchlist()
    refresh()
  }
}

