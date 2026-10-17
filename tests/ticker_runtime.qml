import QtQuick
import QtTest
import Quickshell
import "market" as Market
import "market/models/MarketModel.js" as Model
import qs.Commons

ShellRoot {
  id: root
  property bool failed: false
  property real restingWidth: 0
  property int rotations: 0
  function check(value, message) { if (!value) { failed = true; console.error("UI_FAIL", message) } }
  function panel() {
    for (var i = 0; i < widget.children.length; i++) {
      var child = widget.children[i]
      if ("source" in child && "item" in child) return child.item
    }
    return null
  }
  TestEvent { id: events }
  Connections { target: widget; function onCurrentAssetIndexChanged() { if (service.rotationEnabled) root.rotations++ } }
  Market.MarketService { id: service }
  QtObject { id: host; function serviceFor(id) { return service } }
  QtObject {
    id: bar
    property var shell: host
    property string position: "top"
    property bool vertical: false
    property int barSize: 30
    property color barForeground: "#cacccc"
    property color urgent: "#ef5350"
    property string fontFamily: "monospace"
    property bool foregroundAnimationEnabled: false
    property bool centerHoverRevealSuppressed: false
    property var activePopout: null
    function setCenterHoverRevealSuppressed(value) { centerHoverRevealSuppressed = value }
    function requestPopout(item) { activePopout = item }
    function releasePopout(item) { activePopout = null }
    function registerClickTarget(item) {}
    function unregisterClickTarget(item) {}
    function showTooltip(item, text) {}
    function hideTooltip(item) {}
  }
  PanelWindow {
    visible: true
    implicitWidth: 500; implicitHeight: 60
    Market.BarWidget { id: widget; bar: bar; width: implicitWidth; height: 30 }
    Item { id: outside; x: 460; width: 30; height: 30 }
  }
  Timer {
    interval: 400; running: true
    onTriggered: {
      service.persist(Model.deserializeWatchlist('["BTC","AAPL"]'))
      service.rotationEnabled = false
      service.pinnedAsset = "BTC"
      service.handleProviderQuote("binance", "BTC", Model.normalizeBinanceTicker({ s: "BTCUSDT", c: "81554.97", P: "0.35" }, Date.now()))
    }
  }
  Timer {
    interval: 800; running: true
    onTriggered: {
      root.restingWidth = widget.implicitWidth
      root.check(widget.singleTickerText.indexOf("USDT") < 0 && widget.singleTickerText.indexOf("$") < 0, "crypto bar should omit currency without implying USD")
      root.check(widget.implicitWidth < Style.space(220), "oversized fixed slot remains")
      events.mouseMove(widget, widget.width / 2, widget.height / 2, 0, Qt.NoButton, Qt.NoModifier)
    }
  }
  Timer {
    interval: 1000; running: true
    onTriggered: {
      root.check(widget.implicitWidth === root.restingWidth, "hover changed ticker width")
      root.check(bar.centerHoverRevealSuppressed, "neighbor indicator reveal was not suppressed")
      events.mouseClick(widget, widget.width / 2, widget.height / 2, Qt.LeftButton, 0, 0)
      root.check(root.panel().opened && root.panel().view === "detail" && root.panel().selectedAsset === "BTC", "bar click did not open the displayed ticker chart")
      root.check(service.visibleAsset === "BTC", "clicked chart was not requested")
      root.check(root.panel().activeQuote.currency === "USDT", "detail lost currency metadata")
    }
  }
  Timer {
    interval: 1400; running: true
    onTriggered: {
      root.panel().back()
      root.check(root.panel().view === "watchlist", "watchlist no longer reachable")
      widget.close()
      events.mouseMove(outside, 10, 10, 0, Qt.NoButton, Qt.NoModifier)
    }
  }
  Timer {
    interval: 1700; running: true
    onTriggered: {
      root.check(!bar.centerHoverRevealSuppressed, "hover guard remained after leave/close")
      service.pinnedAsset = "AAPL"
      widget.open()
      root.check(root.panel().selectedAsset === "AAPL" && root.panel().view === "detail", "open used the previous asset")
      widget.close()
      service.rotationEnabled = true
      widget.settings = { speed: 100 }
    }
  }
  Timer {
    interval: 2200; running: true
    onTriggered: {
      root.check(root.rotations > 0, "optional rotation failed")
      widget.close()
      if (!root.failed) console.log("UI_PASS: compact ticker, hover stability, indicator guard, direct chart click, exact units, Back and optional rotation")
      Qt.quit()
    }
  }
}
