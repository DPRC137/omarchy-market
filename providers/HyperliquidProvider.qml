import QtQuick
import Quickshell
import Quickshell.Io
import "../models/MarketModel.js" as MarketModel

Item {
  id: root

  readonly property string providerId: "hyperliquid"
  readonly property string providerName: "Hyperliquid"
  property string status: "DISCONNECTED"
  property int lastUpdateTimestamp: 0
  property var quotes: ({})
  property var candles: ({})
  property bool active: true
  property int reconnectAttempts: 0
  property bool isFetchingSnapshot: false
  property bool isFetchingCandles: false
  property var targetAssets: ["BTC", "ETH", "SOL", "HYPE"]

  readonly property string bridgeScriptPath: Quickshell.env("HOME") + "/.config/omarchy/plugins/io.github.dpr.omarchy-market/scripts/ws_bridge.js"

  signal quoteReceived(string asset, var quote)
  signal candlesReceived(string asset, string timeframe, var candlesList)

  function updateSubscriptions(assetsList) {
    if (!assetsList || !Array.isArray(assetsList)) return
    root.targetAssets = assetsList
    fetchMetaAndContexts()
  }

  function connect() {
    active = true
    status = reconnectAttempts > 0 ? "RECONNECTING" : "CONNECTING"
    fetchMetaAndContexts()
    bridgeProcess.running = true
  }

  function disconnect() {
    active = false
    restartTimer.stop()
    if (bridgeProcess.running) bridgeProcess.running = false
    status = "DISCONNECTED"
  }

  function refresh() {
    fetchMetaAndContexts()
  }

  function fetchMetaAndContexts() {
    if (isFetchingSnapshot) return
    isFetchingSnapshot = true

    try {
      var xhr = new XMLHttpRequest()
      xhr.timeout = 6000
      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          root.isFetchingSnapshot = false
          if (xhr.status === 200) {
            try {
              var data = JSON.parse(xhr.responseText)
              var list = MarketModel.normalizeHyperliquidMeta(data, root.targetAssets, Date.now())
              if (list && list.length > 0) {
                root.status = "CONNECTED"
                root.reconnectAttempts = 0
                root.lastUpdateTimestamp = Date.now()
                var nextQuotes = Object.assign({}, quotes)
                for (var i = 0; i < list.length; i++) {
                  var q = list[i]
                  nextQuotes[q.asset] = q
                  root.quoteReceived(q.asset, q)
                }
                quotes = nextQuotes
              }
            } catch (e) {
              console.warn("HyperliquidProvider: parse error:", e)
            }
          }
        }
      }
      xhr.onerror = function() { root.isFetchingSnapshot = false }
      xhr.ontimeout = function() { root.isFetchingSnapshot = false }
      xhr.open("POST", "https://api.hyperliquid.xyz/info")
      xhr.setRequestHeader("Content-Type", "application/json")
      xhr.send(JSON.stringify({ type: "metaAndAssetCtxs" }))
    } catch (err) {
      isFetchingSnapshot = false
      console.warn("HyperliquidProvider: fetch failed:", err)
    }
  }

  function handleMids(mids) {
    if (!mids) return
    root.status = "CONNECTED"
    root.reconnectAttempts = 0
    root.lastUpdateTimestamp = Date.now()
    var targetAssets = root.targetAssets
    var nextQuotes = Object.assign({}, quotes)

    for (var i = 0; i < targetAssets.length; i++) {
      var sym = targetAssets[i]
      var rawPrice = mids[sym]
      if (rawPrice !== undefined) {
        var price = parseFloat(rawPrice)
        if (!isNaN(price) && price > 0) {
          var existing = nextQuotes[sym] || MarketModel.createEmptyQuote(sym, "hyperliquid")
          var updated = Object.assign({}, existing)
          updated.price = price
          updated.receivedTimestamp = Date.now()
          updated.freshness = "LIVE"
          nextQuotes[sym] = updated
          root.quoteReceived(sym, updated)
        }
      }
    }
    quotes = nextQuotes
  }

  function fetchCandles(asset, timeframe) {
    if (isFetchingCandles) return
    isFetchingCandles = true

    var interval = "1h"
    var durationMs = 24 * 3600 * 1000
    if (timeframe === "4H") { interval = "4h"; durationMs = 7 * 24 * 3600 * 1000 }
    else if (timeframe === "1D") { interval = "1d"; durationMs = 30 * 24 * 3600 * 1000 }
    else if (timeframe === "1W") { interval = "1w"; durationMs = 180 * 24 * 3600 * 1000 }

    var startTime = Date.now() - durationMs
    var reqBody = JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin: asset,
        interval: interval,
        startTime: startTime
      }
    })

    try {
      var xhr = new XMLHttpRequest()
      xhr.timeout = 6000
      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          root.isFetchingCandles = false
          if (xhr.status === 200) {
            try {
              var raw = JSON.parse(xhr.responseText)
              if (Array.isArray(raw)) {
                var list = []
                for (var i = 0; i < raw.length; i++) {
                  var c = raw[i]
                  list.push({
                    time: c.t,
                    open: parseFloat(c.o),
                    high: parseFloat(c.h),
                    low: parseFloat(c.l),
                    close: parseFloat(c.c),
                    volume: parseFloat(c.v)
                  })
                }
                var cMap = Object.assign({}, candles)
                cMap[asset + "_" + timeframe] = list
                candles = cMap
                root.candlesReceived(asset, timeframe, list)
              }
            } catch (e) {
              console.warn("HyperliquidProvider: candle parse error for " + asset + ":", e)
            }
          }
        }
      }
      xhr.onerror = function() { root.isFetchingCandles = false }
      xhr.ontimeout = function() { root.isFetchingCandles = false }
      xhr.open("POST", "https://api.hyperliquid.xyz/info")
      xhr.setRequestHeader("Content-Type", "application/json")
      xhr.send(reqBody)
    } catch (err) {
      isFetchingCandles = false
      console.warn("HyperliquidProvider: candle fetch failed for " + asset + ":", err)
    }
  }

  Process {
    id: bridgeProcess
    command: ["node", root.bridgeScriptPath, "hyperliquid"]
    workingDirectory: Quickshell.env("HOME")

    stdout: SplitParser {
      splitMarker: "\n"
      onRead: function(line) {
        if (!line || !line.trim()) return
        try {
          var msg = JSON.parse(line)
          if (msg.type === "mids" && msg.mids) {
            root.handleMids(msg.mids)
          } else if (msg.type === "status") {
            root.status = msg.status
          }
        } catch (e) {}
      }
    }

    onExited: function(exitCode) {
      if (root.active) {
        root.status = "RECONNECTING"
        root.reconnectAttempts++
        var delay = Math.min(30000, Math.pow(2, Math.min(root.reconnectAttempts, 5)) * 1000)
        delay += Math.floor(Math.random() * 1000)
        restartTimer.interval = delay
        restartTimer.restart()
      }
    }
  }

  Timer {
    id: restartTimer
    repeat: false
    onTriggered: {
      if (root.active && !bridgeProcess.running) {
        bridgeProcess.running = true
      }
    }
  }

  // Periodic REST refresh for full 24h metrics (volume, change%)
  Timer {
    interval: 8000
    running: root.active
    repeat: true
    onTriggered: root.fetchMetaAndContexts()
  }

  Component.onCompleted: {
    if (active) connect()
  }

  Component.onDestruction: disconnect()
}

