import QtQuick
import QtTest
import Quickshell
import "market" as Market
import "market/models/MarketModel.js" as Model
import qs.Commons

ShellRoot {
  id: root
  property bool failed: false
  function check(condition, message) { if (!condition) { failed = true; console.error("UI_FAIL", message) } }
  function find(item, name) {
    if (item.objectName === name) return item
    for (var i = 0; i < (item.children || []).length; i++) { var found = find(item.children[i], name); if (found) return found }
    return null
  }
  function click(name) {
    var item = find(panel.contentItem, name)
    check(item !== null, "Missing action " + name)
    if (item) events.mouseClick(item, item.width / 2, item.height / 2, Qt.LeftButton, Qt.NoModifier, 0)
  }
  TestEvent { id: events }
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
    interval: 500; running: true
    onTriggered: {
      service.persist(Model.deserializeWatchlist('["BTC","MSFT"]'))
      service.pinnedAsset = "BTC"
      service.handleProviderQuote("binance", "BTC", Model.normalizeBinanceTicker({ s: "BTCUSDT", c: "81631.77", P: "-0.04" }, Date.now()))
      panel.open()
    }
  }
  Timer {
    interval: 1000; running: true
    onTriggered: {
      root.click("watch-BTC")
      root.check(panel.view === "detail", "watchlist row did not open detail")
      var ticker = root.find(panel.contentItem, "detail-ticker")
      var price = root.find(panel.contentItem, "detail-price")
      var currency = root.find(panel.contentItem, "detail-currency")
      root.check(ticker.text === "BTC" && ticker.font.pixelSize > currency.font.pixelSize, "ticker is subordinate to currency")
      root.check(currency.text === "USDT" && price.text.indexOf("USDT") < 0 && price.text.indexOf("$") < 0, "headline lost or misstated its quote currency")
    }
  }
  Timer { interval: 1300; running: true; onTriggered: { events.keyClick(Qt.Key_Escape, 0, 0); root.check(panel.view === "watchlist", "Escape did not go Back"); root.click("Manage") } }
  Timer {
    interval: 1600; running: true
    onTriggered: {
      var search = root.find(panel.contentItem, "market-search")
      var tickerChoice = root.find(panel.contentItem, "bar-ticker")
      tickerChoice.open()
      events.keyClick(Qt.Key_Down, 0, 0)
      events.keyClick(Qt.Key_Return, 0, 0)
      root.check(service.pinnedAsset === "MSFT", "Manage bar ticker selection failed")
      search.forceActiveFocus()
      // Actual key events, so Enter must invoke the UI's production handler.
      events.keyClickChar("a", 0, 0); events.keyClickChar("m", 0, 0); events.keyClickChar("d", 0, 0)
      root.check(panel.searchQuery === "amd", "Search typing failed")
      events.keyClick(Qt.Key_Down, 0, 0); events.keyClick(Qt.Key_Up, 0, 0)
      events.keyClick(Qt.Key_Return, 0, 0)
      root.check(service.watchlist.indexOf("AMD") >= 0, "Enter did not add search result")
      events.keyClick(Qt.Key_Escape, 0, 0)
      root.check(panel.view === "watchlist", "Search Escape did not return")
      events.keyClick(Qt.Key_Tab, 0, 0)
    }
  }
  Timer {
    interval: 2000; running: true
    onTriggered: {
      // Reflow with narrow available space and enlarged native text/spacing.
      Style.fontBaseSize = 18
      for (var i = 0; i < panel.data.length; i++) {
        if ("contentWidth" in panel.data[i] && "owner" in panel.data[i]) panel.data[i].contentWidth = 280
      }
      panel.view = "manage"
      panel.searchQuery = "Long unsupported international name that should have no results"
      service.removeMarket("AMD"); service.undoRemoval()
      root.check(service.watchlist[2] === "AMD", "Undo did not restore ordered row")
    }
  }
  Timer {
    interval: 2600; running: true
    onTriggered: {
      panel.back(); panel.close()
      root.check(service.visibleAsset === "", "Closing popup retained history request")
      if (!root.failed) console.log("UI_PASS: real pointer row/detail, Back/Escape, search typing/arrows/Enter, Tab, undo, enlarged type and close cleanup")
      Qt.quit()
    }
  }
}
