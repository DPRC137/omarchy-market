import QtQuick
import Quickshell
import "market" as Market

// Optional live native regression: no fixture values or synthetic candles.
ShellRoot {
  id: root
  property int checks: 0
  property bool captured: false
  Market.MarketService { id: service }
  QtObject { id: host; function serviceFor(id) { return service } }
  QtObject {
    id: bar
    property var shell: host
    property string position: "top"
    property bool vertical: false
    property int barSize: 30
    property color barForeground: "#cacccc"
    property var activePopout: null
    function requestPopout(item) { activePopout = item }
    function releasePopout(item) { activePopout = null }
  }
  PanelWindow {
    visible: true; implicitWidth: 300; implicitHeight: 30
    Item { id: anchor; anchors.fill: parent }
  }
  Market.Panel { id: panel; bar: bar; anchorItem: anchor }
  Timer {
    interval: 300; running: true
    onTriggered: {
      service.addMarket("TSLA")
      panel.openAsset("TSLA")
    }
  }
  Timer {
    interval: 100; running: true; repeat: true
    onTriggered: {
      root.checks++
      if (panel.chartState === "ready" && panel.activeCandles.length > 1 && panel.activeQuote.price > 0 && !root.captured) {
        root.captured = true
        var entry = service.history.entry()
        if (entry.windowLabel !== "Latest regular session" || !entry.sessionDate || entry.currency !== "USD") {
          console.error("UI_FAIL: native session metadata missing"); Qt.quit(); return
        }
        console.log("LIVE_EQUITY", panel.selectedAsset, "candles", panel.activeCandles.length, "session", entry.sessionDate, "quote", panel.activeQuote.price, "state", panel.activeQuote.marketState)
        panel.contentItem.grabToImage(function(result) {
          var path = Quickshell.env("MARKET_EQUITY_CAPTURE")
          if (path && !result.saveToFile(path)) { console.error("UI_FAIL: capture failed"); Qt.quit(); return }
          console.log("UI_PASS: live native Yahoo latest-session chart rendered with real candles and explicit session date")
          Qt.quit()
        })
      }
      if (root.checks > 200) { console.error("UI_FAIL: live Yahoo chart deadline", panel.chartState, panel.chartError); Qt.quit() }
    }
  }
}
