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
    if (yahooProvider) yahooProvider.updateSubscriptions(root.watchlist)
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

  YahooProvider {
    id: yahooProvider
    targetAssets: root.watchlist
    onQuoteReceived: function(asset, quote) { root.handleProviderQuote("yahoo", asset, quote) }
    onCandlesReceived: function(asset, timeframe, list) { root.handleCandles("yahoo", asset, timeframe, list) }
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

  // Historical candle request generation tracking & deterministic provider state
  property int currentCandleRequestId: 0
  property var pendingCandleRequests: ({})
  property var candleRequestProviders: ({})

  function getHistoricalCandleProvider(asset, timeframe) {
    var cat = MarketModel.getCatalogItem(asset)
    if (cat && cat.assetClass === "stock") {
      return "yahoo"
    }
    var isPerpOnly = (asset === "HYPE" || (cat && cat.instrument && cat.instrument.indexOf("PERP") !== -1))
    if (isPerpOnly) {
      return "hyperliquid"
    }
    // Spot crypto: Binance is authoritative primary provider
    return "binance"
  }

  function handleCandles(providerId, asset, timeframe, list) {
    var key = asset + "_" + timeframe
    var expectedInfo = candleRequestProviders[key]

    // Check if response is empty or failed and eligible for Hyperliquid fallback
    if ((!list || list.length === 0) && providerId === "binance" && expectedInfo && !expectedInfo.isFallback) {
      var cat = MarketModel.getCatalogItem(asset)
      if (cat && cat.assetClass === "crypto" && asset !== "HYPE") {
        console.log("[Candles] Primary provider binance returned empty for " + key + ". Invoking Hyperliquid fallback.")
        var nextCp = Object.assign({}, candleRequestProviders)
        nextCp[key] = { provider: "hyperliquid", isFallback: true, reqId: expectedInfo.reqId }
        candleRequestProviders = nextCp
        hyperliquidProvider.fetchCandles(asset, timeframe)
        return
      }
    }

    if (!list || list.length === 0) {
      console.warn("[Candles] No candle bars returned for " + key + " from " + providerId)
      return
    }

    // Populate cache and notify via single canonical reactive path
    var cMap = Object.assign({}, candleStore)
    cMap[key] = list
    candleStore = cMap
    console.log("[Candles] Received " + list.length + " bars for " + key + " from " + providerId)
    root.candlesUpdated(asset, timeframe, list)
    root.updateRevision++ // Single canonical reactive trigger for activeCandles
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
    if (providerId === "yahoo") return yahooProvider.status
    return "UNKNOWN"
  }

  function getCandles(asset, timeframe) {
    var key = asset + "_" + (timeframe || "1H")
    return candleStore[key] || []
  }

  function fetchCandles(asset, timeframe, forceRefresh) {
    var tf = timeframe || "1H"
    var key = asset + "_" + tf
    if (!forceRefresh && candleStore[key] && candleStore[key].length > 0) {
      root.candlesUpdated(asset, tf, candleStore[key])
      return
    }

    root.currentCandleRequestId++
    var reqId = root.currentCandleRequestId
    var pMap = Object.assign({}, root.pendingCandleRequests)
    pMap[key] = reqId
    root.pendingCandleRequests = pMap

    var provider = getHistoricalCandleProvider(asset, tf)
    var cpMap = Object.assign({}, root.candleRequestProviders)
    cpMap[key] = { provider: provider, isFallback: false, reqId: reqId }
    root.candleRequestProviders = cpMap

    console.log("[Candles] Dispatched request #" + reqId + " for " + key + " to " + provider)

    if (provider === "yahoo") {
      yahooProvider.fetchCandles(asset, tf)
    } else if (provider === "hyperliquid") {
      hyperliquidProvider.fetchCandles(asset, tf)
    } else if (provider === "binance") {
      binanceProvider.fetchCandles(asset, tf)
    }
  }

  function fetchQuote(asset) {
    if (!asset) return
    var cat = MarketModel.getCatalogItem(asset)
    if (cat && cat.assetClass === "stock") {
      yahooProvider.fetchQuote(asset)
    }
  }

  function searchYahooMarkets(query, callback) {
    if (yahooProvider) {
      yahooProvider.searchSymbols(query, callback)
    } else if (callback) {
      callback([])
    }
  }

  function refresh() {
    binanceProvider.fetchSnapshot()
    coinbaseProvider.fetchSnapshot()
    hyperliquidProvider.fetchMetaAndContexts()
    yahooProvider.fetchSnapshot()
  }

  Component.onCompleted: {
    console.log("MarketService initialized. Starting market feeds...")
    loadWatchlist()
    refresh()
  }
}

