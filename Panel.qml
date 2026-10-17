import QtQuick
import qs.Commons
import qs.Ui
import "models/MarketModel.js" as MarketModel
import "models/History.js" as History
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
  property bool comparisonOpen: false
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
  readonly property bool isStock: activeQuote.assetClass === "stock"
  readonly property var activeCandles: marketService && revision >= 0 ? marketService.getCandles(selectedAsset, selectedTimeframe) : []
  readonly property string chartState: marketService && marketService.history && revision >= 0 ? marketService.history.state : "unavailable"
  readonly property string chartError: marketService && marketService.history && revision >= 0 ? marketService.history.error : ""
  readonly property var chartEntry: marketService && marketService.history && revision >= 0 ? marketService.history.entry() : null
  readonly property var searchResults: MarketModel.searchCatalog(searchQuery).concat(remoteResults).filter(function(item, index, all) {
    return all.findIndex(function(other) { return other.asset === item.asset; }) === index;
  })

  function open() { view = "watchlist"; controller.show() }
  function openAsset(asset) {
    selectedAsset = asset
    view = "detail"
    controller.show()
    syncChart()
  }
  function close() { controller.hide(); view = "watchlist"; searchQuery = "" }
  function toggle() { opened ? close() : open() }
  function syncChart() {
    if (marketService) marketService.setVisibleChart(opened && view === "detail" ? selectedAsset : "", selectedTimeframe)
  }
  function showDetail(asset) { selectedAsset = asset; view = "detail"; syncChart() }
  function back() { view = "watchlist"; searchQuery = ""; keyCatcher.forceActiveFocus() }
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
  onOpenedChanged: syncChart()
  onViewChanged: syncChart()
  onSelectedTimeframeChanged: syncChart()
  onSearchQueryChanged: {
    searchGeneration++; remoteResults = []; searchIndex = 0; message = ""
    searchState = searchQuery.trim().length >= 2 ? "loading" : "idle"
    debounce.restart()
  }
  Timer {
    id: debounce; interval: 300
    onTriggered: {
      if (!root.marketService || root.searchQuery.trim().length < 2) return
      var generation = root.searchGeneration
      root.marketService.searchYahooMarkets(root.searchQuery, function(results, error) {
        if (generation !== root.searchGeneration) return
        root.remoteResults = results
        root.searchState = error ? "error" : "ready"
      })
    }
  }

  KeyboardPanel {
    id: popup
    anchorItem: root.anchorItem || root
    bar: root.bar
    owner: root
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: Math.min(Style.space(420), (popup.screen ? popup.screen.width : 1024) - Style.space(40))
    contentHeight: Math.min(column.implicitHeight + Style.space(40), (popup.screen ? popup.screen.height : 768) - Style.space(100))

    FocusScope {
      id: keyCatcher
      anchors.fill: parent
      focus: true
      Keys.onEscapePressed: { if (root.view !== "watchlist") root.back(); else root.close() }
      Keys.onPressed: function(event) {
        if (!search.activeFocus && (event.key === Qt.Key_R)) { if (root.marketService) root.marketService.refresh(); event.accepted = true }
        if (!search.activeFocus && event.key === Qt.Key_Slash) { root.view = "manage"; search.forceActiveFocus(); event.accepted = true }
      }
      Flickable {
        id: scroller
        anchors.fill: parent
        contentHeight: column.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        Column {
          id: column
          width: scroller.width
          spacing: Style.space(10)
          Flow {
            width: parent.width
            spacing: Style.space(6)
            MarketAction { text: root.view === "watchlist" ? "Watchlist" : "← Back"; enabled: root.view !== "watchlist"; onClicked: root.back() }
            MarketAction { text: "Manage"; visible: root.view !== "manage"; onClicked: { root.view = "manage"; search.forceActiveFocus() } }
            MarketAction { text: "Refresh"; onClicked: if (root.marketService) root.marketService.refresh() }
          }
          Column {
            visible: root.view === "watchlist"
            width: parent.width; spacing: Style.space(5)
            Repeater {
              model: root.assets
              WatchRow {
                required property string modelData
                width: column.width
                asset: modelData
                quote: root.marketService && root.revision >= 0 ? root.marketService.getQuote(asset) : MarketModel.createEmptyQuote(asset)
                onClicked: root.showDetail(asset)
              }
            }
            Text {
              width: parent.width; wrapMode: Text.Wrap
              text: "Select a market for history. Prices retain their source currency."
              font.pixelSize: Style.font.caption; color: Color.muted
            }
          }
          Column {
            visible: root.view === "detail"
            width: parent.width; spacing: Style.space(9)
            Text {
              width: parent.width; elide: Text.ElideRight
              objectName: "detail-ticker"
              text: root.selectedAsset
              font.family: Style.font.family; font.pixelSize: Style.font.body * 1.6; font.bold: true; color: Color.foreground
            }
            Flow {
              width: parent.width; spacing: Style.space(8)
              Text {
                id: headlinePrice
                objectName: "detail-price"
                width: Math.min(implicitWidth, parent.width); elide: Text.ElideRight
                text: MarketModel.formatPrice(root.activeQuote.price, undefined, root.activeQuote.currency, !root.isStock)
                Accessible.name: MarketModel.formatPrice(root.activeQuote.price, undefined, root.activeQuote.currency)
                font.family: Style.font.family; font.pixelSize: Style.font.body * 2; font.bold: true; color: Color.foreground
              }
              Text {
                objectName: "detail-currency"
                height: headlinePrice.height; verticalAlignment: Text.AlignVCenter
                text: root.activeQuote.currency || ""
                font.family: Style.font.family; font.pixelSize: Style.font.caption; color: Util.alpha(Color.foreground, 0.75)
              }
            }
            Text {
              width: parent.width; wrapMode: Text.Wrap; textFormat: Text.PlainText
              text: MarketModel.providerDisplayName(root.activeQuote.provider) + " · " + (root.activeQuote.currency || "Currency pending") + " · " + root.activeQuote.priceType + "\n" + root.activeQuote.symbol + " · " + root.activeQuote.freshness + " · Quote " + MarketModel.formatAge(root.activeQuote.providerTimestamp, root.marketService ? root.marketService.now : Date.now()) + "\nConnection: " + (root.marketService && root.revision >= 0 ? root.marketService.getProviderStatus(root.activeQuote.provider) : "DISCONNECTED") + " · Received " + MarketModel.formatAge(root.activeQuote.receivedTimestamp, root.marketService ? root.marketService.now : Date.now()) + (root.marketService && root.marketService.getProviderError(root.activeQuote.provider) ? "\n" + root.marketService.getProviderError(root.activeQuote.provider) : "")
              font.family: Style.font.family; font.pixelSize: Style.font.caption; color: Util.alpha(Color.foreground, 0.75)
            }
            Text {
              width: parent.width; wrapMode: Text.Wrap
              text: (root.isStock ? "Regular session · " + root.activeQuote.marketState + " · vs previous close: " : "Rolling 24 hours: ") + MarketModel.formatPercentage(root.activeQuote.change24h)
              font.pixelSize: Style.font.bodySmall
              color: root.activeQuote.change24h === null ? Color.muted : root.activeQuote.change24h >= 0 ? "#26a69a" : "#ef5350"
            }
            Text {
              width: parent.width; wrapMode: Text.Wrap
              text: (root.isStock ? "Session" : "24h") + " high " + MarketModel.formatPrice(root.activeQuote.high24h, undefined, root.activeQuote.currency) + " · Low " + MarketModel.formatPrice(root.activeQuote.low24h, undefined, root.activeQuote.currency) + "\nVolume " + MarketModel.formatVolume(root.activeQuote.volume24h, root.activeQuote.volumeUnit)
              font.pixelSize: Style.font.caption; color: Color.foreground
            }
            Row {
              spacing: Style.space(5)
              Repeater {
                model: History.RANGES
                MarketAction {
                  required property string modelData
                  text: modelData; selected: root.selectedTimeframe === modelData
                  onClicked: root.selectedTimeframe = modelData
                }
              }
            }
            SparklineChart {
              objectName: "market-chart"
              visible: root.activeCandles.length > 0
              width: parent.width; height: Style.space(140)
              points: root.activeCandles
              currency: root.chartEntry ? root.chartEntry.currency : root.activeQuote.currency || ""
              isPositive: root.activeCandles.length >= 2 ? root.activeCandles[root.activeCandles.length - 1].close >= root.activeCandles[0].close : true
            }
            Text {
              width: parent.width; wrapMode: Text.Wrap; textFormat: Text.PlainText
              objectName: "history-status"
              text: (root.chartState === "loading" ? "Loading history…" : root.chartState === "unavailable" ? "History unavailable · " + root.chartError : root.chartState === "stale" ? "Stale cached history · " + (root.chartError || "Refresh to update") : (root.activeCandles.length === 1 ? "1 candle available; waiting for more · " : "History updated ") + MarketModel.formatAge(root.chartEntry ? root.chartEntry.savedAt : 0, root.marketService ? root.marketService.now : Date.now())) + (root.chartEntry && root.chartEntry.windowLabel ? "\n" + root.chartEntry.windowLabel + (root.chartEntry.sessionDate ? " · " + root.chartEntry.sessionDate : "") : "") + (root.activeCandles.length ? "\n" + new Date(root.activeCandles[0].time).toLocaleString() + " – " + new Date(root.activeCandles[root.activeCandles.length - 1].time).toLocaleString() : "") + "\n" + MarketModel.providerDisplayName(MarketModel.selectedProvider(root.selectedAsset)) + " · Trade candles · " + (root.chartEntry ? root.chartEntry.interval : "")
              font.pixelSize: Style.font.caption; color: root.chartState === "unavailable" || root.chartState === "stale" ? Color.foreground : Util.alpha(Color.foreground, 0.75)
            }
            MarketAction { text: "Retry history"; visible: root.chartState === "stale" || root.chartState === "unavailable"; onClicked: if (root.marketService) root.marketService.fetchCandles(root.selectedAsset, root.selectedTimeframe, true) }
            MarketAction { text: root.comparisonOpen ? "▾ Exchange comparison" : "▸ Exchange comparison"; onClicked: root.comparisonOpen = !root.comparisonOpen }
            Column {
              width: parent.width; spacing: Style.space(6); visible: root.comparisonOpen
              Repeater {
                model: root.isStock ? ["yahoo"] : ["binance", "coinbase", "hyperliquid"]
                Text {
                  required property string modelData
                  readonly property var quote: root.marketService && root.revision >= 0 ? root.marketService.getProviderQuote(root.selectedAsset, modelData) : null
                  width: column.width; wrapMode: Text.Wrap; textFormat: Text.PlainText
                  text: MarketModel.providerDisplayName(modelData) + (modelData === "hyperliquid" ? " · Perp" : modelData === "yahoo" ? " · Equity" : " · Spot") + " · " + (quote ? MarketModel.formatPrice(quote.price, undefined, quote.currency) + " · " + quote.freshness + " · " + MarketModel.formatAge(quote.providerTimestamp, root.marketService.now) : "Unavailable")
                  font.pixelSize: Style.font.caption
                  color: quote && (quote.freshness === "LIVE" || quote.freshness === "CURRENT") ? "#26a69a" : Color.muted
                }
              }
            }
          }
          Column {
            width: parent.width; spacing: Style.space(8); visible: root.view === "manage"
            Dropdown {
              objectName: "bar-ticker"
              width: parent.width
              label: "Bar ticker when rotation is off"
              options: root.assets
              value: root.marketService ? root.marketService.pinnedAsset : ""
              onChanged: function(value) { if (root.marketService) root.marketService.pinnedAsset = value }
            }
            MarketAction { text: root.marketService && root.marketService.rotationEnabled ? "Rotation: on" : "Rotation: off"; onClicked: if (root.marketService) root.marketService.rotationEnabled = !root.marketService.rotationEnabled }
            Text { text: "Watchlist · " + root.assets.length + " / 20"; font.pixelSize: Style.font.bodySmall; font.bold: true; color: Color.foreground }
            BorderSurface {
              width: parent.width; height: Style.space(36)
              color: Style.normalFillAlpha; radius: Style.cornerRadius
              borderSpec: Border.controlSpec(search.activeFocus ? "selected" : "normal", Color.foreground, Color.accent)
              TextInput {
                id: search
                objectName: "market-search"
                onActiveFocusChanged: if (activeFocus) scroller.contentY = 0
                anchors.fill: parent; anchors.margins: Style.space(8)
                text: root.searchQuery; onTextChanged: root.searchQuery = text
                font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; color: Color.foreground
                clip: true; activeFocusOnTab: true; selectByMouse: true
                Accessible.name: "Search markets"
                Text { visible: !search.text; text: "Search symbol or name…"; color: Color.muted; font: search.font }
                Keys.onDownPressed: root.searchIndex = Math.min(root.searchResults.length - 1, root.searchIndex + 1)
                Keys.onUpPressed: root.searchIndex = Math.max(0, root.searchIndex - 1)
                Keys.onReturnPressed: root.addResult(root.searchIndex)
                Keys.onEnterPressed: root.addResult(root.searchIndex)
              }
            }
            Text {
              width: parent.width; wrapMode: Text.Wrap
              visible: root.searchQuery.length > 0
              text: root.searchState === "loading" ? "Searching Yahoo… Local results available below." : root.searchState === "error" ? "Search failed. Edit your search to retry; local results remain available." : root.searchResults.length === 0 ? "No results" : "↑ / ↓ to select · Enter to add"
              font.pixelSize: Style.font.caption; color: Color.muted
            }
            Repeater {
              model: root.searchQuery ? root.searchResults : []
              MarketAction {
                required property var modelData
                required property int index
                width: column.width
                text: "+ " + modelData.asset + " · " + modelData.name
                selected: root.searchIndex === index
                onClicked: root.addResult(index)
              }
            }
            Text { text: root.message; visible: text !== ""; color: Color.foreground; font.pixelSize: Style.font.caption; textFormat: Text.PlainText }
            MarketAction { text: "Undo removal"; visible: root.marketService && root.marketService.removedItem !== null; onClicked: { root.marketService.undoRemoval(); root.message = "Removal undone" } }
            Repeater {
              model: root.assets
              Row {
                required property string modelData
                required property int index
                width: column.width; spacing: Style.space(5)
                MarketAction { width: parent.width - Style.space(120); text: parent.modelData; onClicked: root.showDetail(parent.modelData) }
                MarketAction { width: Style.space(35); text: "↑"; Accessible.name: "Move " + parent.modelData + " up"; enabled: parent.index > 0; onClicked: root.marketService.reorderMarket(parent.index, parent.index - 1) }
                MarketAction { width: Style.space(35); text: "↓"; Accessible.name: "Move " + parent.modelData + " down"; enabled: parent.index < root.assets.length - 1; onClicked: root.marketService.reorderMarket(parent.index, parent.index + 1) }
                MarketAction { width: Style.space(35); text: "×"; Accessible.name: "Remove " + parent.modelData; onClicked: root.remove(parent.modelData) }
              }
            }
          }
        }
      }
    }
  }
}
