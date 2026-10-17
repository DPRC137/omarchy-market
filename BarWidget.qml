import QtQuick
import qs.Commons
import qs.Ui
import "models/MarketModel.js" as MarketModel

BarWidget {
  id: root
  moduleName: "io.github.dpr.omarchy-market"

  readonly property var marketService: (bar && bar.shell) ? bar.shell.serviceFor("io.github.dpr.omarchy-market") : null
  readonly property int updateRevision: marketService ? marketService.updateRevision : 0
  readonly property var watchlist: (marketService && marketService.watchlist) ? marketService.watchlist : ["BTC", "ETH", "SOL", "HYPE"]

  property int currentAssetIndex: 0
  readonly property string currentAsset: (watchlist && watchlist.length > 0) ? (marketService && !marketService.rotationEnabled && watchlist.indexOf(marketService.pinnedAsset) >= 0 ? marketService.pinnedAsset : watchlist[currentAssetIndex % watchlist.length] || "BTC") : "BTC"
  readonly property var currentQuote: (marketService && updateRevision >= 0) ? marketService.getQuote(currentAsset, "aggregate") : MarketModel.createEmptyQuote(currentAsset, "aggregate")

  // Default to clean cycling single-asset display so it never collides with center clock
  property bool multiAssetMode: setting("multiAsset", false)
  property int tickerSpeedMs: setting("speed", 4000)

  // Single asset compact ticker text (e.g. "BTC $72.8K ▲4.8%")
  readonly property string singleTickerText: {
    if (!marketService) return "MARKET"
    var rev = marketService.updateRevision
    var q = currentQuote
    if (q && q.price > 0) {
      var arrow = q.change24h >= 0 ? "▲" : "▼"
      return currentAsset + " " + MarketModel.formatCompactPrice(q.price, q.currency) + " " + arrow + (q.change24h === null ? "—" : Math.abs(q.change24h).toFixed(1) + "%") + (q.freshness === "STALE" ? " · stale" : "")
    }
    return currentAsset + " ..."
  }

  // Multi-asset compact text (bounded to max 2 items to prevent bar overflow)
  readonly property string multiTickerText: {
    if (!marketService) return "MARKET"
    var rev = marketService.updateRevision
    var parts = []
    var count = Math.min(watchlist.length, 2)
    for (var i = 0; i < count; i++) {
      var sym = watchlist[(currentAssetIndex + i) % watchlist.length]
      var q = marketService.getQuote(sym, "aggregate")
      if (q && q.price > 0) {
        var arrow = q.change24h >= 0 ? "▲" : "▼"
        parts.push(sym + " " + MarketModel.formatCompactPrice(q.price, q.currency) + " " + arrow + (q.change24h === null ? "—" : Math.abs(q.change24h).toFixed(1) + "%") + (q.freshness === "STALE" ? " · stale" : ""))
      }
    }
    return parts.join(" · ")
  }

  readonly property string displayTickerText: root.multiAssetMode ? root.multiTickerText : root.singleTickerText

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("selectedAsset" in target) target.selectedAsset = root.currentAsset
  }

  function refresh() {
    if (marketService) marketService.refresh()
  }

  function togglePanel() {
    if (panelLoader.item) {
      panelLoader.item.selectedAsset = root.currentAsset
      panelLoader.item.toggle()
    }
  }

  function open() {
    if (panelLoader.item) {
      panelLoader.item.selectedAsset = root.currentAsset
      panelLoader.item.open()
    }
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  // Auto-cycling timer for smooth ticker rotation
  Timer {
    id: cycleTimer
    interval: root.tickerSpeedMs
    running: root.marketService && root.marketService.rotationEnabled && !root.opened && !buttonHover.hovered && root.watchlist.length > 1
    repeat: true
    onTriggered: {
      root.currentAssetIndex = (root.currentAssetIndex + 1) % root.watchlist.length
    }
  }

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  HoverHandler {
    id: buttonHover
  }

  clip: true

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.vertical ? (root.currentAsset + "\n" + MarketModel.formatCompactPrice(root.currentQuote.price, root.currentQuote.currency)) : root.displayTickerText
    tooltipText: "Omarchy Market (Click to open terminal, Middle-click to refresh, Right-click to switch asset)"

    onPressed: function(mouseButton) {
      if (mouseButton === Qt.MiddleButton) {
        root.refresh()
      } else if (mouseButton === Qt.RightButton) {
        root.currentAssetIndex = (root.watchlist.indexOf(root.currentAsset) + 1) % root.watchlist.length
        if (root.marketService) root.marketService.pinnedAsset = root.watchlist[root.currentAssetIndex]
      } else {
        root.togglePanel()
      }
    }
  }

  implicitWidth: root.vertical ? barSize : Style.space(220)
  implicitHeight: root.vertical ? button.implicitHeight : barSize
}
