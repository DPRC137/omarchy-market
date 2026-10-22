import QtQuick
import Quickshell
import "market/providers"

ShellRoot {
  id: root
  property bool failed: false
  property int quotes: 0
  function check(ok, reason) { if (!ok) { failed = true; console.error("WS_NATIVE_FAIL:", reason); Qt.quit() } }
  CryptoProvider {
    id: feed
    providerId: "binance"
    onQuoteReceived: function(asset, quote) {
      root.quotes++
      root.check(asset === "BTC" && quote.price === 321.12 && quote.currency === "USDT", "bounded IPC changed quote semantics")
      root.check(quote.change24h === 2.5 && quote.high24h === 330 && quote.low24h === 310, "projected ticker lost required fields")
      feed.updateSubscriptions([])
      finish.start()
    }
  }
  Component.onCompleted: {
    feed.targetAssets = ["BTC"]
    feed.active = true
    feed.consumeBridgeLine(JSON.stringify({type:"ticker",provider:"binance",raw:{s:"BTCUSDT",c:"1",unused:"x".repeat(5000)}}))
    root.check(quotes === 0, "oversized IPC line parsed and accepted")
    feed.consumeBridgeLine(JSON.stringify({type:"ticker",provider:"binance",raw:{s:"BTCUSDT",c:"1",unused:"€".repeat(1000)}}))
    root.check(quotes === 0, "non-ASCII IPC line accepted")
    feed.consumeBridgeLine(JSON.stringify({type:"ticker",provider:"coinbase",raw:{s:"BTCUSDT",c:"1"}}))
    root.check(quotes === 0, "provider mismatch accepted")
    feed.consumeBridgeLine("{malformed")
    feed.consumeBridgeLine(JSON.stringify({type:"status",provider:"binance",status:"untrusted"}))
    root.check(feed.status === "DISCONNECTED", "unknown status accepted")
    // updateSubscriptions starts the real helper; cancel REST work synchronously
    // so only the local WebSocket peer can deliver this harness's quote.
    feed.targetAssets = []
    feed.updateSubscriptions(["BTC"])
    feed.client.cancel(function() { return true })
    feed.consumeBridgeLine(JSON.stringify({type:"ticker",provider:"binance",raw:{s:"ETHUSDT",c:"1"}}))
    root.check(quotes === 0, "unwatched symbol accepted")
  }
  Timer {
    id: finish; interval:200
    onTriggered: {
      root.check(!feed.childProcessRunning, "disabled provider retained helper")
      root.check(root.quotes === 1, "attack or duplicate quote reached provider")
      if (root.failed) return
      console.log("WS_NATIVE_PASS: pre-parse guard, oversized stream rejection/recovery, real projected ticker, disable cleanup")
      Qt.quit()
    }
  }
  Timer { interval:10000; running:true; onTriggered:{console.error("WS_NATIVE_FAIL: timeout");Qt.quit()} }
}
