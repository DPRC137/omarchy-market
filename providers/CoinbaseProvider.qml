import QtQuick
import Quickshell
import Quickshell.Io
import "../models/MarketModel.js" as MarketModel

Item {
  id: root

  readonly property string providerId: "coinbase"
  readonly property string providerName: "Coinbase"
  property string status: "DISCONNECTED"
  property int lastUpdateTimestamp: 0
  property var quotes: ({})
  property var candles: ({})
  property bool active: true
  property int reconnectAttempts: 0
  property bool isFetchingSnapshot: false
  property bool isFetchingCandles: false

  readonly property string bridgeScriptPath: Quickshell.env("HOME") + "/.config/omarchy/plugins/io.github.dpr.omarchy-market/scripts/ws_bridge.js"

  signal quoteReceived(string asset, var quote)
  signal candlesReceived(string asset, string timeframe, var candlesList)

  function connect() {
    active = true
    status = reconnectAttempts > 0 ? "RECONNECTING" : "CONNECTING"
    fetchSnapshot()
    bridgeProcess.running = true
  }

  function disconnect() {
    active = false
    restartTimer.stop()
    if (bridgeProcess.running) bridgeProcess.running = false
    status = "DISCONNECTED"
  }

  function fetchSnapshot() {
    if (isFetchingSnapshot) return
    isFetchingSnapshot = true
    var assets = ["BTC", "ETH", "SOL"]
    for (var i = 0; i < assets.length; i++) {
      fetchAsset(assets[i])
    }
  }

  function fetchAsset(asset) {
    var productId = asset + "-USD"
    var url = "https://api.exchange.coinbase.com/products/" + productId + "/ticker"
    try {
      var xhr = new XMLHttpRequest()
      xhr.timeout = 5000
      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          root.isFetchingSnapshot = false
          if (xhr.status === 200) {
            try {
              var data = JSON.parse(xhr.responseText)
              data.type = "ticker"
              data.product_id = productId
              fetchAssetStats(asset, data)
            } catch (e) {
              console.warn("CoinbaseProvider: parse error for " + asset + ":", e)
            }
          }
        }
      }
      xhr.onerror = function() { root.isFetchingSnapshot = false }
      xhr.ontimeout = function() { root.isFetchingSnapshot = false }
      xhr.open("GET", url)
      xhr.setRequestHeader("User-Agent", "omarchy-market")
      xhr.send()
    } catch (err) {
      isFetchingSnapshot = false
      console.warn("CoinbaseProvider: fetch failed for " + asset + ":", err)
    }
  }

  function fetchAssetStats(asset, tickerData) {
    var productId = asset + "-USD"
    var url = "https://api.exchange.coinbase.com/products/" + productId + "/stats"
    try {
      var xhr = new XMLHttpRequest()
      xhr.timeout = 5000
      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
          try {
            var stats = JSON.parse(xhr.responseText)
            tickerData.open_24h = stats.open
            tickerData.high_24h = stats.high
            tickerData.low_24h = stats.low
            tickerData.volume_24h = stats.volume
            handleRawTicker(tickerData)
          } catch (e) {
            console.warn("CoinbaseProvider: stats parse error for " + asset + ":", e)
          }
        }
      }
      xhr.open("GET", url)
      xhr.setRequestHeader("User-Agent", "omarchy-market")
      xhr.send()
    } catch (err) {
      console.warn("CoinbaseProvider: stats fetch failed for " + asset + ":", err)
    }
  }

  function handleRawTicker(raw) {
    if (!raw) return
    var quote = MarketModel.normalizeCoinbaseTicker(raw, Date.now())
    if (quote && quote.asset) {
      root.status = "CONNECTED"
      root.reconnectAttempts = 0
      root.lastUpdateTimestamp = Date.now()
      var nextQuotes = Object.assign({}, quotes)
      nextQuotes[quote.asset] = quote
      quotes = nextQuotes
      root.quoteReceived(quote.asset, quote)
    }
  }

  function fetchCandles(asset, timeframe) {
    if (asset === "HYPE" || isFetchingCandles) return
    isFetchingCandles = true

    var productId = asset + "-USD"
    var granularity = 3600 // 1H
    if (timeframe === "4H") granularity = 14400
    else if (timeframe === "1D") granularity = 86400
    else if (timeframe === "1W") granularity = 86400 * 7

    var url = "https://api.exchange.coinbase.com/products/" + productId + "/candles?granularity=" + granularity
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
                var count = Math.min(raw.length, 30)
                for (var i = count - 1; i >= 0; i--) {
                  var c = raw[i]
                  list.push({
                    time: c[0] * 1000,
                    open: parseFloat(c[3]),
                    high: parseFloat(c[2]),
                    low: parseFloat(c[1]),
                    close: parseFloat(c[4]),
                    volume: parseFloat(c[5])
                  })
                }
                var cMap = Object.assign({}, candles)
                cMap[asset + "_" + timeframe] = list
                candles = cMap
                root.candlesReceived(asset, timeframe, list)
              }
            } catch (e) {
              console.warn("CoinbaseProvider: candle parse error:", e)
            }
          }
        }
      }
      xhr.onerror = function() { root.isFetchingCandles = false }
      xhr.ontimeout = function() { root.isFetchingCandles = false }
      xhr.open("GET", url)
      xhr.setRequestHeader("User-Agent", "omarchy-market")
      xhr.send()
    } catch (err) {
      isFetchingCandles = false
      console.warn("CoinbaseProvider: candle fetch failed:", err)
    }
  }

  Process {
    id: bridgeProcess
    command: ["node", root.bridgeScriptPath, "coinbase"]
    workingDirectory: Quickshell.env("HOME")

    stdout: SplitParser {
      splitMarker: "\n"
      onRead: function(line) {
        if (!line || !line.trim()) return
        try {
          var msg = JSON.parse(line)
          if (msg.type === "ticker" && msg.raw) {
            root.handleRawTicker(msg.raw)
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

  Component.onCompleted: {
    if (active) connect()
  }

  Component.onDestruction: disconnect()
}
