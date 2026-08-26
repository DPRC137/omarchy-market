import QtQuick
import Quickshell
import "../models/MarketModel.js" as MarketModel

Item {
  id: root

  readonly property string providerId: "yahoo"
  readonly property string providerName: "Yahoo Finance"
  property string status: "DISCONNECTED" // DISCONNECTED, CONNECTING, CONNECTED, STALE, FAILED
  property int lastUpdateTimestamp: 0
  property var quotes: ({})
  property var candles: ({})
  property bool active: true
  property var targetAssets: []

  // Internal rate-limiting and scheduler state
  property var queue: []
  property var inFlightTask: null
  property bool inFlight: false
  property int backoffAttempts: 0
  property bool isBackingOff: false
  property string currentMarketState: "regular" // "regular", "preMarket", "postMarket", "closed"

  readonly property string userAgent: "Mozilla/5.0 (X11; Linux x86_64) OmarchyMarket/1.0"
  readonly property int requestTimeoutMs: 6000
  readonly property int minRequestSpacingMs: 1200
  readonly property int normalPollIntervalMs: 60000
  readonly property int closedPollIntervalMs: 300000

  signal quoteReceived(string asset, var quote)
  signal candlesReceived(string asset, string timeframe, var candlesList)

  function updateSubscriptions(assetsList) {
    if (!assetsList || !Array.isArray(assetsList)) return
    var filtered = []
    for (var i = 0; i < assetsList.length; i++) {
      var sym = String(assetsList[i] || "").trim().toUpperCase()
      var cat = MarketModel.getCatalogItem(sym)
      if (cat && cat.assetClass === "stock") {
        filtered.push(sym)
      }
    }
    root.targetAssets = filtered
    if (root.active && filtered.length > 0) {
      fetchSnapshot()
    }
  }

  function connect() {
    active = true
    status = "CONNECTING"
    if (root.targetAssets.length > 0) {
      fetchSnapshot()
    }
  }

  function disconnect() {
    active = false
    status = "DISCONNECTED"
    queue = []
    inFlight = false
    inFlightTask = null
    isBackingOff = false
    backoffTimer.stop()
    requestSpacingTimer.stop()
    pollTimer.stop()
  }

  function refresh() {
    fetchSnapshot()
  }

  // Fetch an individual quote on demand (e.g. when selected in UI)
  function fetchQuote(asset) {
    if (!asset || !root.active) return
    var sym = String(asset).trim().toUpperCase()
    var cat = MarketModel.getCatalogItem(sym)
    if (!cat || cat.assetClass !== "stock") return
    enqueueTask({
      type: "quote",
      asset: sym,
      priority: 10
    })
    processQueue()
  }

  // Enqueue a full snapshot of quotes across subscribed stocks
  function fetchSnapshot() {
    if (!root.active || root.targetAssets.length === 0) return
    for (var i = 0; i < root.targetAssets.length; i++) {
      enqueueTask({
        type: "quote",
        asset: root.targetAssets[i],
        priority: 10
      })
    }
    processQueue()
  }

  // Enqueue an on-demand historical candle request for a stock
  function fetchCandles(asset, timeframe) {
    if (!asset) return
    var sym = String(asset).trim().toUpperCase()
    var cat = MarketModel.getCatalogItem(sym)
    if (!cat || cat.assetClass !== "stock") return

    var tf = timeframe || "1H"
    enqueueTask({
      type: "candle",
      asset: sym,
      timeframe: tf,
      priority: 5
    })
    processQueue()
  }

  function enqueueTask(task) {
    // Deduplication check against in-flight task
    if (root.inFlightTask) {
      if (task.type === "quote" && root.inFlightTask.type === "quote" && root.inFlightTask.asset === task.asset) {
        return
      }
      if (task.type === "candle" && root.inFlightTask.type === "candle" && root.inFlightTask.asset === task.asset && root.inFlightTask.timeframe === task.timeframe) {
        return
      }
    }

    // Deduplication check against already queued tasks
    for (var i = 0; i < root.queue.length; i++) {
      var qItem = root.queue[i]
      if (task.type === "quote" && qItem.type === "quote" && qItem.asset === task.asset) {
        return
      }
      if (task.type === "candle" && qItem.type === "candle" && qItem.asset === task.asset && qItem.timeframe === task.timeframe) {
        return
      }
    }

    var nextQueue = root.queue.slice()
    // Prioritized insertion: higher priority (quotes: 10) before lower priority (candles: 5)
    var inserted = false
    for (var j = 0; j < nextQueue.length; j++) {
      if (task.priority > nextQueue[j].priority) {
        nextQueue.splice(j, 0, task)
        inserted = true
        break
      }
    }
    if (!inserted) {
      nextQueue.push(task)
    }
    root.queue = nextQueue
  }

  function processQueue() {
    // Invariant: Never allow more than one in-flight XMLHttpRequest
    if (!root.active || root.inFlight || root.isBackingOff || requestSpacingTimer.running || root.queue.length === 0) {
      return
    }

    var nextQueue = root.queue.slice()
    var task = nextQueue.shift()
    root.queue = nextQueue
    root.inFlight = true
    root.inFlightTask = task

    if (task.type === "quote") {
      executeQuoteRequest(task)
    } else if (task.type === "candle") {
      executeCandleRequest(task)
    }
  }

  function executeQuoteRequest(task) {
    var symbol = task.asset
    var url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=1m&range=2d&includePrePost=true"

    try {
      var xhr = new XMLHttpRequest()
      xhr.timeout = root.requestTimeoutMs

      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          handleResponse(xhr, task, function(responseText) {
            try {
              var data = JSON.parse(responseText)
              var quote = MarketModel.normalizeYahooChart(data, Date.now())
              if (quote && quote.asset) {
                root.status = "CONNECTED"
                root.backoffAttempts = 0
                root.lastUpdateTimestamp = Date.now()
                root.currentMarketState = quote.marketState || "regular"

                var nextQuotes = Object.assign({}, root.quotes)
                nextQuotes[quote.asset] = quote
                root.quotes = nextQuotes
                root.quoteReceived(quote.asset, quote)
              }
            } catch (err) {
              console.warn("YahooProvider: parse error for quote " + symbol + ":", err)
            }
          })
        }
      }

      xhr.onerror = function() {
        handleNetworkFailure(task, "network error")
      }
      xhr.ontimeout = function() {
        handleNetworkFailure(task, "timeout")
      }

      xhr.open("GET", url)
      xhr.setRequestHeader("User-Agent", root.userAgent)
      xhr.send()
    } catch (e) {
      handleNetworkFailure(task, String(e))
    }
  }

  function executeCandleRequest(task) {
    var symbol = task.asset
    var tf = task.timeframe || "1H"
    var interval = "5m"
    var range = "5d"

    if (tf === "4H") {
      interval = "30m"
      range = "1mo"
    } else if (tf === "1D") {
      interval = "1d"
      range = "6mo"
    } else if (tf === "1W") {
      interval = "1d"
      range = "2y"
    } else if (tf === "1M") {
      interval = "1mo"
      range = "10y"
    }

    var url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?interval=" + interval + "&range=" + range

    try {
      var xhr = new XMLHttpRequest()
      xhr.timeout = root.requestTimeoutMs

      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          handleResponse(xhr, task, function(responseText) {
            try {
              var data = JSON.parse(responseText)
              var list = MarketModel.normalizeYahooCandles(data)
              if (Array.isArray(list)) {
                var cMap = Object.assign({}, root.candles)
                cMap[symbol + "_" + tf] = list
                root.candles = cMap
                root.candlesReceived(symbol, tf, list)
              }
            } catch (err) {
              console.warn("YahooProvider: parse error for candles " + symbol + " (" + tf + "):", err)
            }
          })
        }
      }

      xhr.onerror = function() {
        handleNetworkFailure(task, "network error")
      }
      xhr.ontimeout = function() {
        handleNetworkFailure(task, "timeout")
      }

      xhr.open("GET", url)
      xhr.setRequestHeader("User-Agent", root.userAgent)
      xhr.send()
    } catch (e) {
      handleNetworkFailure(task, String(e))
    }
  }

  function handleResponse(xhr, task, onSuccess) {
    var httpStatus = xhr.status

    if (httpStatus === 200) {
      if (onSuccess) onSuccess(xhr.responseText)
      finishRequest()
      scheduleNextRequest(root.minRequestSpacingMs)
      return
    }

    // Rate-limit or server error conditions: 429, 403, 5xx
    if (httpStatus === 429 || httpStatus === 403 || httpStatus >= 500) {
      console.warn("YahooProvider: rate limit / server error HTTP " + httpStatus + " for " + task.asset + ", backing off")
      triggerBackoff()
      return
    }

    // Other non-200 responses (e.g. 404 / 400)
    console.warn("YahooProvider: HTTP " + httpStatus + " for " + task.asset)
    finishRequest()
    scheduleNextRequest(root.minRequestSpacingMs)
  }

  function handleNetworkFailure(task, reason) {
    console.warn("YahooProvider: request failed for " + task.asset + " (" + reason + ")")
    finishRequest()
    scheduleNextRequest(root.minRequestSpacingMs)
  }

  function finishRequest() {
    root.inFlight = false
    root.inFlightTask = null
  }

  function scheduleNextRequest(delayMs) {
    requestSpacingTimer.interval = Math.max(100, delayMs || root.minRequestSpacingMs)
    requestSpacingTimer.restart()
  }

  function triggerBackoff() {
    finishRequest()
    root.isBackingOff = true
    if (root.status === "CONNECTED") root.status = "STALE"

    // Exponential backoff: 5s, 10s, 20s, 40s, max 60s + jitter
    var baseDelay = Math.min(60000, Math.pow(2, Math.min(root.backoffAttempts, 4)) * 5000)
    var jitter = Math.floor(Math.random() * 2000)
    var totalDelay = baseDelay + jitter
    root.backoffAttempts++

    console.log("YahooProvider: backing off for " + (totalDelay / 1000).toFixed(1) + "s (attempt " + root.backoffAttempts + ")")
    backoffTimer.interval = totalDelay
    backoffTimer.restart()
  }

  Timer {
    id: requestSpacingTimer
    repeat: false
    onTriggered: {
      root.processQueue()
    }
  }

  Timer {
    id: backoffTimer
    repeat: false
    onTriggered: {
      root.isBackingOff = false
      root.processQueue()
    }
  }

  // Periodic polling timer
  Timer {
    id: pollTimer
    interval: root.currentMarketState === "closed" ? root.closedPollIntervalMs : root.normalPollIntervalMs
    running: root.active && root.targetAssets.length > 0
    repeat: true
    onTriggered: {
      // Don't hammer Yahoo with 20 requests if the market is closed overnight
      if (root.currentMarketState === "closed") {
        // Run low-frequency single cycle or skip if recent data is retained
        root.fetchSnapshot()
      } else {
        root.fetchSnapshot()
      }
    }
  }

  // Stale detection timer
  Timer {
    interval: 15000
    running: root.active
    repeat: true
    onTriggered: {
      if (root.status === "CONNECTED" && root.lastUpdateTimestamp > 0 && (Date.now() - root.lastUpdateTimestamp > 90000)) {
        root.status = "STALE"
      }
    }
  }

  Component.onCompleted: {
    if (active) connect()
  }

  Component.onDestruction: disconnect()
}
