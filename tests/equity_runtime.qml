import QtQuick
import Quickshell
import "market" as Market

// Optional live native regression: no fixture values or synthetic candles.
ShellRoot {
  id: root
  property int checks: 0
  property bool captured: false
  property string targetAsset: Quickshell.env("MARKET_EQUITY_ASSET") || "TSLA"
  property string targetRange: Quickshell.env("MARKET_EQUITY_RANGE") || "1D"
  function find(item,name) {
    if(item.objectName===name)return item
    for(var i=0;i<(item.children||[]).length;i++){var found=find(item.children[i],name);if(found)return found}
    return null
  }
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
      service.addMarket(root.targetAsset)
      panel.selectedTimeframe=root.targetRange
      panel.openAsset(root.targetAsset)
    }
  }
  Timer {
    interval: 100; running: true; repeat: true
    onTriggered: {
      root.checks++
      if (panel.chartState === "ready" && panel.activeCandles.length > 1 && panel.activeQuote.price > 0 && !root.captured) {
        root.captured = true
        var entry = service.history.entry()
        if ((root.targetRange === "1D" && (entry.windowLabel !== "Latest regular session" || !entry.sessionDate)) || entry.currency !== panel.activeQuote.currency) {
          console.error("UI_FAIL: native session metadata missing"); Qt.quit(); return
        }
        var summary=root.find(panel.contentItem,"window-summary")
        var points=panel.activeCandles
        if (!summary || summary.stats.count !== points.length || summary.stats.first !== points[0].close || summary.stats.last !== points[points.length-1].close) {
          console.error("UI_FAIL: selected-window summary does not match live history"); Qt.quit(); return
        }
        console.log("LIVE_WINDOW",root.targetRange,"change",summary.stats.changePercent,"high",summary.stats.high,"low",summary.stats.low,"mean",summary.stats.mean)
        console.log("LIVE_EQUITY", panel.selectedAsset, "candles", panel.activeCandles.length, "session", entry.sessionDate, "quote", panel.activeQuote.price, "state", panel.activeQuote.marketState)
        panel.contentItem.parent.parent.grabToImage(function(result) {
          var path = Quickshell.env("MARKET_EQUITY_CAPTURE")
          if (path && !result.saveToFile(path)) { console.error("UI_FAIL: capture failed"); Qt.quit(); return }
          console.log("UI_PASS: live native Yahoo chart and selected-window stats rendered with real candles and source/session metadata")
          Qt.quit()
        })
      }
      if (root.checks > 200) { console.error("UI_FAIL: live Yahoo chart deadline", panel.chartState, panel.chartError); Qt.quit() }
    }
  }
}
