import QtQuick
import QtQuick.Controls
import QtQuick.Window
import qs.Commons
import qs.Ui
import "models/MarketModel.js" as MarketModel
import "ui"

Panel {
  id: root
  moduleName: "io.github.dpr.omarchy-market"
  ipcTarget: "omarchy-market"
  manageIpc: false
  property var anchorItem: null
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root
  property string view: "watchlist"
  property string selectedAsset: "BTC"
  property string selectedTimeframe: "1D"
  property string searchQuery: ""
  property var remoteResults: []
  property string searchState: "idle"
  property string message: ""
  property int searchIndex: 0
  property int searchGeneration: 0
  property alias contentItem: keyCatcher
  readonly property var marketService: bar && bar.shell ? bar.shell.serviceFor(moduleName) : null
  readonly property int revision: marketService ? marketService.updateRevision : 0
  readonly property var assets: marketService ? marketService.watchlist : []
  readonly property var activeQuote: marketService && revision >= 0 ? marketService.getQuote(selectedAsset) : MarketModel.createEmptyQuote(selectedAsset)
  readonly property var activeCandles: marketService && revision >= 0 ? marketService.getCandles(selectedAsset, selectedTimeframe) : []
  readonly property string chartState: marketService && marketService.history && revision >= 0 ? marketService.history.state : "unavailable"
  readonly property string chartError: marketService && marketService.history && revision >= 0 ? marketService.history.error : ""
  readonly property var searchResults: MarketModel.searchCatalog(searchQuery).concat(remoteResults).filter(function(item, index, all) {
    return all.findIndex(function(other) { return other.asset === item.asset; }) === index;
  })
  readonly property bool editingSearch: manage.searchFocused || watchlist.searchFocused

  function open() { view = "watchlist"; controller.show() }
  function openAsset(asset) { selectedAsset = asset; view = "detail"; controller.show(); syncChart() }
  function close() { controller.hide(); view = "watchlist"; searchQuery = "" }
  function toggle() { opened ? close() : open() }
  function syncChart() {
    if (marketService) marketService.setVisibleChart(opened && view === "detail" ? selectedAsset : "", selectedTimeframe)
  }
  function showDetail(asset) { selectedAsset = asset; view = "detail"; keyCatcher.forceActiveFocus(); syncChart() }
  function findItem(item, name) {
    if (item.objectName === name) return item
    for (var i = 0; i < (item.children || []).length; i++) {
      var result = findItem(item.children[i], name)
      if (result) return result
    }
    return null
  }
  function back() {
    view = "watchlist"; searchQuery = ""
    Qt.callLater(function() {
      if (!root.opened || root.view !== "watchlist") return
      var row = findItem(watchlist, "watch-" + selectedAsset)
      if (row && row.visible) row.forceActiveFocus(); else keyCatcher.forceActiveFocus()
      ensureFocusVisible()
    })
  }
  function showManage() {
    view = "manage"
    Qt.callLater(function() { if (root.opened && root.view === "manage") manage.focusSearch() })
  }
  function addResult(index) {
    if (!marketService || !searchResults[index]) return
    var result = marketService.addMarket(searchResults[index])
    message = result.success ? searchResults[index].asset + " added" : result.reason === "DUPLICATE" ? "Already in watchlist" : result.reason === "MAX_LIMIT" ? "Watchlist limit: 20" : "Unsupported instrument"
  }
  function remove(asset) {
    if (!marketService) return
    var result = marketService.removeMarket(asset)
    message = result.success ? asset + " removed" : "Keep at least one instrument"
  }
  function ensureFocusVisible() {
    var window = keyCatcher.Window.window
    var item = window ? window.activeFocusItem : null
    if (!item || !item.visible) return
    var ancestor = item
    while (ancestor && ancestor !== column) ancestor = ancestor.parent
    if (!ancestor) return
    var position = item.mapToItem(column, 0, 0)
    if (position.y < scroller.contentY) scroller.contentY = position.y
    else if (position.y + item.height > scroller.contentY + scroller.height)
      scroller.contentY = Math.min(Math.max(0, scroller.contentHeight - scroller.height), position.y + item.height - scroller.height)
  }
  onOpenedChanged: syncChart()
  onViewChanged: { syncChart(); scroller.contentY = 0 }
  onSelectedTimeframeChanged: syncChart()
  onSearchQueryChanged: {
    searchGeneration++; remoteResults = []; searchIndex = 0; message = ""
    searchState = searchQuery.trim().length >= 2 ? "loading" : "idle"
    debounce.restart()
  }
  Timer {
    id: debounce; interval: 300
    onTriggered: {
      if (!root.marketService || root.searchQuery.trim().length < 2 || !root.opened || root.view !== "manage") return
      var generation = root.searchGeneration
      root.marketService.searchYahooMarkets(root.searchQuery, function(results, error) {
        if (generation !== root.searchGeneration) return
        root.remoteResults = results
        root.searchState = error ? "error" : "ready"
      })
    }
  }
  MarketTokens { id: tokens }
  KeyboardPanel {
    id: popup
    anchorItem: root.anchorItem || root
    bar: root.bar
    owner: root
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: Math.max(180, Math.min(Style.space(460), (popup.screen ? popup.screen.width : 1024) - Style.space(64)))
    contentHeight: Math.min(header.height + column.implicitHeight + popup.verticalContentInset, (popup.screen ? popup.screen.height : 768) - Style.space(100))
    FocusScope {
      id: keyCatcher
      anchors.fill: parent
      focus: true
      Keys.onEscapePressed: { if (root.view !== "watchlist") root.back(); else root.close() }
      Keys.onPressed: function(event) {
        if (!root.editingSearch && event.key === Qt.Key_R) { if (root.marketService) root.marketService.refresh(); event.accepted = true }
        if (!root.editingSearch && event.key === Qt.Key_Slash) { root.showManage(); event.accepted = true }
        if (event.key === Qt.Key_Tab || event.key === Qt.Key_Backtab) Qt.callLater(root.ensureFocusVisible)
      }
      Connections {
        target: keyCatcher.Window.window
        function onActiveFocusItemChanged() { Qt.callLater(root.ensureFocusVisible) }
      }
      Item {
        id: header
        width: parent.width
        height: toolbar.implicitHeight + Style.space(8)
        Flow {
          id: toolbar
          width: parent.width
          spacing: Style.space(4)
          MarketAction {
            id: backAction
            visible: root.view !== "watchlist"
            text: "← Back"
            onClicked: root.back()
          }
          Text {
            visible: root.view === "watchlist"
            width: Math.max(Style.space(70), parent.width - manageAction.width - refreshAction.width - parent.spacing * 2)
            height: refreshAction.height
            text: "Markets"
            color: tokens.foreground
            font.family: Style.font.family
            font.pixelSize: Style.font.body
            font.bold: true
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
          }
          MarketAction { id: manageAction; text: "Manage"; visible: root.view !== "manage"; onClicked: root.showManage() }
          MarketAction {
            id: refreshAction
            objectName: "market-refresh"
            text: root.marketService && root.marketService.refreshing ? "Refreshing…" : "Refresh"
            Accessible.description: "Refresh market quotes and visible chart. Shortcut R."
            onClicked: if (root.marketService) root.marketService.refresh()
          }
        }
      }
      Flickable {
        id: scroller
        anchors { top: header.bottom; bottom: parent.bottom; left: parent.left; right: parent.right }
        contentHeight: column.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        ScrollBar.vertical: ScrollBar { policy: ScrollBar.AsNeeded }
        Column {
          id: column
          width: scroller.width
          WatchlistView {
            id: watchlist
            width: parent.width
            visible: root.view === "watchlist"
            service: root.marketService; revision: root.revision; assets: root.assets
            onSelected: function(asset) { root.showDetail(asset) }
            onManageRequested: root.showManage()
          }
          AssetDetail {
            width: parent.width
            visible: root.view === "detail"
            service: root.marketService; revision: root.revision
            asset: root.selectedAsset; timeframe: root.selectedTimeframe
            onTimeframeSelected: function(value) { root.selectedTimeframe = value }
          }
          ManageView {
            id: manage
            width: parent.width
            visible: root.view === "manage"
            service: root.marketService; revision: root.revision; assets: root.assets
            searchQuery: root.searchQuery; searchResults: root.searchResults; searchState: root.searchState
            searchIndex: root.searchIndex; message: root.message
            onQueryEdited: function(query) { root.searchQuery = query }
            onIndexSelected: function(index) { root.searchIndex = index }
            onAddRequested: function(index) { root.addResult(index) }
            onRemoveRequested: function(asset) { root.remove(asset) }
            onSelected: function(asset) { root.showDetail(asset) }
            onMessageChangedByUser: function(value) { root.message = value }
          }
        }
      }
    }
  }
}
