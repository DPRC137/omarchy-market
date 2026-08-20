import QtQuick
import Quickshell
import Quickshell.Io
import "../models/MarketModel.js" as MarketModel

Item {
  id: root

  readonly property string providerId: "binance"
  readonly property string providerName: "Binance"
  property string status: "DISCONNECTED" // DISCONNECTED, CONNECTING, CONNECTED, STALE, RECONNECTING, FAILED
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

    try {
      var xhr = new XMLHttpRequest()
      xhr.timeout = 5000
      xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          root.isFetchingSnapshot = false
          if (xhr.status === 200) {
            try {
              var arr = JSON.parse(xhr.responseText)
              if (Array.isArray(arr)) {
                for (var i = 0; i < arr.length; i++) {
                  handleRawTicker(arr[i])
                }
              }
            } catch (e) {
              console.warn("BinanceProvider: snapshot parse error:", e)
            }
          }
        }
      }
      xhr.onerror = function() { root.isFetchingSnapshot = false }
      xhr.ontimeout = function() { root.isFetchingSnapshot = false }
      xhr.open("GET", "https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D")
      xhr.send()
    } catch (err) {
      isFetchingSnapshot = false
      console.warn("BinanceProvider: snapshot fetch failed:", err)
    }
  }

  function fetchCandles(asset, timeframe) {
    var symbol = (asset === "BTC" || asset === "ETH" || asset === "SOL") ? (asset + "USDT") : ""
    if (!symbol || isFetchingCandles) return
    isFetchingCandles = true

    var interval = "1h"
    var limit = 30
    if (timeframe === "4H") { interval = "4h"; limit = 30 }
    else if (timeframe === "1D") { interval = "1d"; limit = 30 }
    else if (timeframe === "1W") { interval = "1w"; limit = 26 }

    var url = "https://api.binance.com/api/v3/klines?symbol=" + symbol + "&interval=" + interval + "&limit=" + limit
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
                    time: parseInt(c[0], 10),
                    open: parseFloat(c[1]),
                    high: parseFloat(c[2]),
                    low: parseFloat(c[3]),
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
              console.warn("BinanceProvider: candle parse error:", e)
            }
          }
        }
      }
      xhr.onerror = function() { root.isFetchingCandles = false }
      xhr.ontimeout = function() { root.isFetchingCandles = false }
      xhr.open("GET", url)
      xhr.send()
    } catch (err) {
      isFetchingCandles = false
      console.warn("BinanceProvider: candle fetch failed:", err)
    }
  }

  function handleRawTicker(raw) {
    if (!raw) return
    var quote = MarketModel.normalizeBinanceTicker(raw, Date.now())
    if (quote && quote.asset) {
      status = "CONNECTED"
      reconnectAttempts = 0
      lastUpdateTimestamp = Date.now()
      var nextQuotes = Object.assign({}, quotes)
      nextQuotes[quote.asset] = quote
      quotes = nextQuotes
      root.quoteReceived(quote.asset, quote)
    }
  }

  Process {
    id: bridgeProcess
    command: ["node", root.bridgeScriptPath, "binance"]
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

  // Periodic health check / stale detection timer
  Timer {
    interval: 10000
    running: root.active
    repeat: true
    onTriggered: {
      if (root.status === "CONNECTED" && Date.now() - root.lastUpdateTimestamp > 30000) {
        root.status = "STALE"
        root.fetchSnapshot()
      }
    }
  }

  Component.onCompleted: {
    if (active) connect()
  }

  Component.onDestruction: disconnect()
}
