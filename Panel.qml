import QtQuick
import Quickshell
import Quickshell.Io
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

  property string selectedAsset: "BTC"
  property string selectedTimeframe: "1H"
  property bool watchlistManagerOpen: false
  property string searchQuery: ""
  property var remoteSearchResults: []

  Timer {
    id: remoteSearchDebounceTimer
    interval: 300
    repeat: false
    onTriggered: {
      var q = root.searchQuery.trim()
      if (!q || q.length < 2) {
        root.remoteSearchResults = []
        return
      }
      if (root.marketService) {
        root.marketService.searchYahooMarkets(q, function(results) {
          if (root.searchQuery.trim() === q) {
            var local = root.marketService.searchMarkets(q)
            var localSymbols = {}
            for (var i = 0; i < local.length; i++) {
              localSymbols[local[i].asset] = true
            }
            var uniqueRemote = []
            for (var j = 0; j < results.length; j++) {
              var sym = results[j].asset
              if (!localSymbols[sym]) {
                uniqueRemote.push(results[j])
              }
            }
            root.remoteSearchResults = uniqueRemote
          }
        })
      }
    }
  }

  onSearchQueryChanged: {
    root.remoteSearchResults = []
    if (root.searchQuery.trim().length >= 2) {
      remoteSearchDebounceTimer.restart()
    } else {
      remoteSearchDebounceTimer.stop()
    }
  }

  readonly property var marketService: (bar && bar.shell) ? bar.shell.serviceFor("io.github.dpr.omarchy-market") : null
  readonly property int updateRevision: marketService ? marketService.updateRevision : 0
  readonly property var assets: (marketService && marketService.watchlist && marketService.watchlist.length > 0) ? marketService.watchlist : ["BTC", "ETH", "SOL", "HYPE"]
  readonly property var structuredWatchlist: (marketService && marketService.structuredWatchlist) ? marketService.structuredWatchlist : MarketModel.createDefaultWatchlist()

  readonly property var activeQuote: (marketService && updateRevision >= 0) ? marketService.getQuote(selectedAsset, "aggregate") : MarketModel.createEmptyQuote(selectedAsset, "aggregate")
  readonly property var binanceQuote: (marketService && updateRevision >= 0) ? marketService.getProviderQuote(selectedAsset, "binance") : null
  readonly property var coinbaseQuote: (marketService && updateRevision >= 0) ? marketService.getProviderQuote(selectedAsset, "coinbase") : null
  readonly property var hyperliquidQuote: (marketService && updateRevision >= 0) ? marketService.getProviderQuote(selectedAsset, "hyperliquid") : null
  readonly property var yahooQuote: (marketService && updateRevision >= 0) ? marketService.getProviderQuote(selectedAsset, "yahoo") : null
  readonly property var activeCandles: (marketService && updateRevision >= 0) ? marketService.getCandles(selectedAsset, selectedTimeframe) : []

  readonly property var selectedCatItem: MarketModel.getCatalogItem(selectedAsset)
  readonly property bool isStock: selectedCatItem && selectedCatItem.assetClass === "stock"
  readonly property bool isSelectedInWatchlist: marketService ? marketService.isInWatchlist(selectedAsset) : (assets.indexOf(selectedAsset) !== -1)

  function open() {
    root.controller.show()
    if (marketService) {
      marketService.fetchQuote(selectedAsset)
      marketService.fetchCandles(selectedAsset, selectedTimeframe)
      marketService.refresh()
    }
  }

  function close() {
    root.watchlistManagerOpen = false
    root.searchQuery = ""
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  onSelectedAssetChanged: {
    if (marketService) {
      marketService.fetchQuote(selectedAsset)
      marketService.fetchCandles(selectedAsset, selectedTimeframe)
    }
  }

  onSelectedTimeframeChanged: {
    if (marketService) marketService.fetchCandles(selectedAsset, selectedTimeframe)
  }

  KeyboardPanel {
    id: keyboardPanel
    anchorItem: root.anchorItem || root
    bar: root.bar
    owner: root
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: Style.space(360)
    contentHeight: contentColumn.implicitHeight + Style.space(48)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: {
        if (root.watchlistManagerOpen) {
          root.watchlistManagerOpen = false
          root.searchQuery = ""
        } else {
          root.close()
        }
      }
      onTabRequested: function(direction) {
        if (root.watchlistManagerOpen) return
        var idx = root.assets.indexOf(root.selectedAsset)
        if (idx !== -1) {
          var nextIdx = (idx + direction + root.assets.length) % root.assets.length
          root.selectedAsset = root.assets[nextIdx]
        }
      }
      onTextKey: function(t) {
        if (!root.watchlistManagerOpen && (t === "r" || t === "R")) {
          if (root.marketService) root.marketService.refresh()
        }
      }

      Column {
        id: contentColumn
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: Style.space(4)
        spacing: Style.space(12)

        // 1. Asset Switcher Header (Horizontally Scrollable Tabs + Edit Control)
        Row {
          width: parent.width
          height: Style.space(30)
          spacing: Style.space(6)

          // Scrollable Tabs Container
          Item {
            width: parent.width - editBtn.width - Style.space(6)
            height: parent.height

            Flickable {
              id: tabsFlickable
              anchors.fill: parent
              contentWidth: tabsRow.implicitWidth
              contentHeight: height
              boundsBehavior: Flickable.StopAtBounds
              clip: true

              Row {
                id: tabsRow
                height: parent.height
                spacing: Style.space(5)

                Repeater {
                  model: root.assets

                  Item {
                    id: tabItem
                    width: Math.max(Style.space(54), tabText.implicitWidth + Style.space(16))
                    height: Style.space(28)
                    anchors.verticalCenter: parent.verticalCenter

                    readonly property bool isCurrent: root.selectedAsset === modelData

                    HoverHandler { id: tabHover }

                    BorderSurface {
                      anchors.fill: parent
                      radius: Style.cornerRadius
                      color: tabItem.isCurrent ? Style.selectionFillAlpha : (tabHover.hovered ? Style.hoverFillAlpha : Style.normalFillAlpha)
                      borderSpec: Border.controlSpec(tabItem.isCurrent ? "selected" : (tabHover.hovered ? "hover" : "normal"), Color.foreground, Color.accent)

                      Text {
                        id: tabText
                        anchors.centerIn: parent
                        text: modelData
                        font.family: Style.font.family
                        font.pixelSize: Style.font.bodySmall
                        font.bold: tabItem.isCurrent
                        color: tabItem.isCurrent ? Color.accent : (tabHover.hovered ? Color.foreground : Util.alpha(Color.foreground, 0.85))
                      }

                      MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                          root.selectedAsset = modelData
                          root.watchlistManagerOpen = false
                        }
                      }
                    }
                  }
                }
              }
            }

            // Left scroll affordance fade
            Rectangle {
              id: leftTabFade
              anchors.left: parent.left
              anchors.top: parent.top
              anchors.bottom: parent.bottom
              width: Style.space(16)
              z: 2
              visible: tabsFlickable.contentX > 2
              gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0.0; color: Color.background }
                GradientStop { position: 1.0; color: "transparent" }
              }
            }

            // Right scroll affordance fade
            Rectangle {
              id: rightTabFade
              anchors.right: parent.right
              anchors.top: parent.top
              anchors.bottom: parent.bottom
              width: Style.space(16)
              z: 2
              visible: (tabsFlickable.contentWidth > tabsFlickable.width) &&
                       (tabsFlickable.contentX < tabsFlickable.contentWidth - tabsFlickable.width - 2)
              gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0.0; color: "transparent" }
                GradientStop { position: 1.0; color: Color.background }
              }
            }
          }

          // Small Edit / Settings Control strictly adjacent to asset tabs
          Item {
            id: editBtn
            width: Style.space(28)
            height: Style.space(28)
            anchors.verticalCenter: parent.verticalCenter

            HoverHandler { id: editHover }

            BorderSurface {
              anchors.fill: parent
              radius: Style.cornerRadius
              color: root.watchlistManagerOpen ? Style.selectionFillAlpha : (editHover.hovered ? Style.hoverFillAlpha : Style.normalFillAlpha)
              borderSpec: Border.controlSpec(root.watchlistManagerOpen ? "selected" : (editHover.hovered ? "hover" : "normal"), Color.foreground, Color.accent)

              Text {
                anchors.centerIn: parent
                text: "⚙"
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                color: root.watchlistManagerOpen ? Color.accent : (editHover.hovered ? Color.foreground : Util.alpha(Color.foreground, 0.8))
              }

              MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                  root.watchlistManagerOpen = !root.watchlistManagerOpen
                  if (root.watchlistManagerOpen) {
                    root.searchQuery = ""
                  }
                }
              }
            }
          }
        }

        // -------------------------------------------------------------
        // VIEW A: WATCHLIST MANAGER (Native Quattro-styled Overlay View)
        // -------------------------------------------------------------
        Column {
          id: watchlistManagerView
          width: parent.width
          spacing: Style.space(10)
          visible: root.watchlistManagerOpen

          // Manager Header (Title, Counter, Close)
          Row {
            width: parent.width
            height: Style.space(24)

            Text {
              anchors.verticalCenter: parent.verticalCenter
              text: "WATCHLIST"
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
              font.bold: true
              color: Color.foreground
            }

            Item {
              width: Math.max(1, parent.width - parent.children[0].width - parent.children[2].width - parent.children[3].width)
              height: 1
            }

            // Counter Badge (e.g. "4 / 20")
            Text {
              anchors.verticalCenter: parent.verticalCenter
              text: root.assets.length + " / 20"
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
              color: Color.muted
            }

            // Close manager button
            Item {
              width: Style.space(24)
              height: Style.space(24)
              anchors.verticalCenter: parent.verticalCenter

              HoverHandler { id: closeHover }

              Text {
                anchors.centerIn: parent
                text: "✕"
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                font.bold: true
                color: closeHover.hovered ? Color.foreground : Color.muted
              }

              MouseArea {
                anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                  root.watchlistManagerOpen = false
                  root.searchQuery = ""
                }
              }
            }
          }

          // Search / Add Box
          BorderSurface {
            width: parent.width
            height: Style.space(32)
            radius: Style.cornerRadius
            color: Style.normalFillAlpha
            borderSpec: Border.controlSpec(searchInput.activeFocus ? "selected" : "normal", Color.foreground, Color.accent)

            Row {
              anchors.fill: parent
              anchors.leftMargin: Style.space(8)
              anchors.rightMargin: Style.space(8)
              spacing: Style.space(6)

              Text {
                anchors.verticalCenter: parent.verticalCenter
                text: "🔍"
                font.pixelSize: Style.font.caption
                color: Color.muted
              }

              TextInput {
                id: searchInput
                width: parent.width - Style.space(24)
                anchors.verticalCenter: parent.verticalCenter
                clip: true
                font.family: Style.font.family
                font.pixelSize: Style.font.bodySmall
                color: Color.foreground
                selectionColor: Color.accent
                selectedTextColor: Color.foreground

                Text {
                  anchors.fill: parent
                  text: "Search market or alias (e.g. AAPL, dogecoin, NVDA)..."
                  font.family: Style.font.family
                  font.pixelSize: Style.font.bodySmall
                  color: Color.muted
                  visible: !searchInput.text && !searchInput.activeFocus
                }

                onTextChanged: root.searchQuery = searchInput.text.trim()
              }
            }
          }

          // Quick-Add Stock Suggestions (when search is empty)
          Column {
            width: parent.width
            spacing: Style.space(6)
            visible: root.searchQuery.length === 0

            Text {
              text: "FEATURED STOCKS"
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
              font.bold: true
              color: Color.muted
            }

            Flow {
              width: parent.width
              spacing: Style.space(6)

              Repeater {
                model: ["AAPL", "NVDA", "MSFT", "TSLA", "AMZN", "GOOGL", "META", "AMD"]

                Item {
                  width: chipSurface.implicitWidth
                  height: Style.space(24)

                  readonly property string chipAsset: modelData
                  readonly property var catItem: MarketModel.getCatalogItem(chipAsset)
                  readonly property bool alreadyInWatchlist: root.marketService ? root.marketService.isInWatchlist(chipAsset) : (root.assets.indexOf(chipAsset) !== -1)
                  readonly property bool isFull: root.assets.length >= 20

                  HoverHandler { id: chipHover }

                  BorderSurface {
                    id: chipSurface
                    anchors.fill: parent
                    implicitWidth: chipRow.implicitWidth + Style.space(12)
                    radius: Style.space(4)
                    color: alreadyInWatchlist ? Qt.rgba(0.15, 0.65, 0.60, 0.15) : (chipHover.hovered ? Style.hoverFillAlpha : Style.normalFillAlpha)
                    borderSpec: Border.flat(alreadyInWatchlist ? "#26a69a" : (chipHover.hovered ? Color.accent : Color.muted), 1)

                    Row {
                      id: chipRow
                      anchors.centerIn: parent
                      spacing: Style.space(4)

                      Text {
                        text: chipAsset
                        font.family: Style.font.family
                        font.pixelSize: Style.font.caption
                        font.bold: true
                        color: alreadyInWatchlist ? "#26a69a" : Color.foreground
                        anchors.verticalCenter: parent.verticalCenter
                      }

                      Text {
                        text: alreadyInWatchlist ? "✓" : "+"
                        font.family: Style.font.family
                        font.pixelSize: Style.font.caption
                        font.bold: true
                        color: alreadyInWatchlist ? "#26a69a" : Color.accent
                        anchors.verticalCenter: parent.verticalCenter
                      }
                    }

                    MouseArea {
                      anchors.fill: parent
                      enabled: !alreadyInWatchlist && !isFull
                      cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                      onClicked: {
                        if (root.marketService) {
                          root.marketService.addMarket(chipAsset)
                          root.selectedAsset = chipAsset
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          // Search Results Dropdown / List (when typing)
          Column {
            width: parent.width
            spacing: Style.space(4)
            visible: root.searchQuery.length > 0

            readonly property var localResults: (root.marketService && root.searchQuery) ? root.marketService.searchMarkets(root.searchQuery) : MarketModel.searchCatalog(root.searchQuery)
            readonly property var results: localResults.concat(root.remoteSearchResults)

            Text {
              text: "SEARCH RESULTS"
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
              font.bold: true
              color: Color.muted
              visible: parent.results.length > 0
            }

            Text {
              text: "No supported markets found"
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
              color: Color.muted
              visible: parent.results.length === 0
            }

            Repeater {
              model: parent.results

              Item {
                width: parent.width
                height: Style.space(30)

                readonly property var catItem: modelData
                readonly property bool alreadyInWatchlist: root.marketService ? root.marketService.isInWatchlist(catItem.asset) : (root.assets.indexOf(catItem.asset) !== -1)
                readonly property bool isFull: root.assets.length >= 20

                HoverHandler { id: searchItemHover }

                BorderSurface {
                  anchors.fill: parent
                  radius: Style.cornerRadius
                  color: searchItemHover.hovered ? Style.hoverFillAlpha : Style.normalFillAlpha
                  borderSpec: Border.controlSpec("normal", Color.foreground, Color.accent)

                  Row {
                    anchors.left: parent.left
                    anchors.leftMargin: Style.space(8)
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.space(6)

                    Text {
                      text: catItem.asset
                      font.family: Style.font.family
                      font.pixelSize: Style.font.bodySmall
                      font.bold: true
                      color: Color.foreground
                    }

                    Text {
                      text: "• " + catItem.name
                      font.family: Style.font.family
                      font.pixelSize: Style.font.caption
                      color: Color.muted
                    }

                    Text {
                      text: "• " + (catItem.assetClass === "stock" ? "STOCK" : "CRYPTO")
                      font.family: Style.font.family
                      font.pixelSize: Style.font.caption
                      font.bold: true
                      color: catItem.assetClass === "stock" ? Color.accent : Color.muted
                    }
                  }

                  // Action Badge (+ Add / Added / Full)
                  BorderSurface {
                    anchors.right: parent.right
                    anchors.rightMargin: Style.space(6)
                    anchors.verticalCenter: parent.verticalCenter
                    implicitWidth: actionText.implicitWidth + Style.space(12)
                    implicitHeight: Style.space(22)
                    radius: Style.space(4)
                    color: alreadyInWatchlist ? Qt.rgba(0.15, 0.65, 0.60, 0.15) : (isFull ? Style.normalFillAlpha : Style.selectionFillAlpha)
                    borderSpec: Border.flat(alreadyInWatchlist ? "#26a69a" : (isFull ? Color.muted : Color.accent), 1)

                    Text {
                      id: actionText
                      anchors.centerIn: parent
                      text: alreadyInWatchlist ? "Added ✓" : (isFull ? "Full (20)" : "+ Add")
                      font.family: Style.font.family
                      font.pixelSize: Style.font.caption
                      font.bold: true
                      color: alreadyInWatchlist ? "#26a69a" : (isFull ? Color.muted : Color.foreground)
                    }

                    MouseArea {
                      anchors.fill: parent
                      enabled: !alreadyInWatchlist && !isFull
                      cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                      onClicked: {
                        if (root.marketService) {
                          root.marketService.addMarket(catItem.asset)
                          root.selectedAsset = catItem.asset
                          searchInput.text = ""
                          root.searchQuery = ""
                        }
                      }
                    }
                  }
                }
              }
            }

            PanelSeparator { width: parent.width }
          }

          // Active Watchlist Items (Reorder & Delete List)
          Column {
            width: parent.width
            spacing: Style.space(6)

            Text {
              text: "ACTIVE WATCHLIST"
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
              font.bold: true
              color: Color.muted
            }

            // Scrollable List of Markets
            ListView {
              id: watchlistListView
              width: parent.width
              height: Math.min(Style.space(220), count * Style.space(36))
              model: root.assets
              clip: true
              boundsBehavior: Flickable.StopAtBounds
              spacing: Style.space(4)

              delegate: Item {
                width: watchlistListView.width
                height: Style.space(32)

                readonly property string assetName: modelData
                readonly property var catItem: MarketModel.getCatalogItem(assetName) || { name: assetName, instrument: "SPOT" }
                readonly property bool isSelected: root.selectedAsset === assetName

                HoverHandler { id: rowHover }

                BorderSurface {
                  anchors.fill: parent
                  radius: Style.cornerRadius
                  color: isSelected ? Style.selectionFillAlpha : (rowHover.hovered ? Style.hoverFillAlpha : Style.normalFillAlpha)
                  borderSpec: Border.controlSpec(isSelected ? "selected" : "normal", Color.foreground, Color.accent)

                  // Left: Asset Symbol & Name
                  Row {
                    anchors.left: parent.left
                    anchors.leftMargin: Style.space(8)
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.space(6)

                    Text {
                      text: "★ " + assetName
                      font.family: Style.font.family
                      font.pixelSize: Style.font.bodySmall
                      font.bold: true
                      color: isSelected ? Color.accent : Color.foreground
                    }

                    Text {
                      text: "• " + catItem.name
                      font.family: Style.font.family
                      font.pixelSize: Style.font.caption
                      color: Color.muted
                    }
                  }

                  // Right: Action Buttons (↑, ↓, Delete)
                  Row {
                    anchors.right: parent.right
                    anchors.rightMargin: Style.space(6)
                    anchors.verticalCenter: parent.verticalCenter
                    spacing: Style.space(4)

                    // Move Up Button
                    Item {
                      width: Style.space(22)
                      height: Style.space(22)
                      visible: index > 0

                      HoverHandler { id: upHover }
                      BorderSurface {
                        anchors.fill: parent
                        radius: Style.space(4)
                        color: upHover.hovered ? Style.hoverFillAlpha : "transparent"
                        borderSpec: Border.flat(upHover.hovered ? Color.accent : Color.muted, 1)

                        Text {
                          anchors.centerIn: parent
                          text: "↑"
                          font.pixelSize: Style.font.caption
                          font.bold: true
                          color: upHover.hovered ? Color.foreground : Color.muted
                        }
                      }
                      MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                          if (root.marketService) root.marketService.reorderMarket(index, index - 1)
                        }
                      }
                    }

                    // Move Down Button
                    Item {
                      width: Style.space(22)
                      height: Style.space(22)
                      visible: index < root.assets.length - 1

                      HoverHandler { id: downHover }
                      BorderSurface {
                        anchors.fill: parent
                        radius: Style.space(4)
                        color: downHover.hovered ? Style.hoverFillAlpha : "transparent"
                        borderSpec: Border.flat(downHover.hovered ? Color.accent : Color.muted, 1)

                        Text {
                          anchors.centerIn: parent
                          text: "↓"
                          font.pixelSize: Style.font.caption
                          font.bold: true
                          color: downHover.hovered ? Color.foreground : Color.muted
                        }
                      }
                      MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                          if (root.marketService) root.marketService.reorderMarket(index, index + 1)
                        }
                      }
                    }

                    // Delete Button
                    Item {
                      width: Style.space(22)
                      height: Style.space(22)
                      visible: root.assets.length > 1

                      HoverHandler { id: delHover }
                      BorderSurface {
                        anchors.fill: parent
                        radius: Style.space(4)
                        color: delHover.hovered ? Qt.rgba(0.93, 0.32, 0.31, 0.25) : "transparent"
                        borderSpec: Border.flat(delHover.hovered ? "#ef5350" : Color.muted, 1)

                        Text {
                          anchors.centerIn: parent
                          text: "✕"
                          font.pixelSize: Style.font.caption
                          font.bold: true
                          color: delHover.hovered ? "#ef5350" : Color.muted
                        }
                      }
                      MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                          var targetDel = assetName
                          if (root.marketService) {
                            root.marketService.removeMarket(targetDel)
                            if (root.selectedAsset === targetDel) {
                              root.selectedAsset = root.assets[0] || "BTC"
                            }
                          }
                        }
                      }
                    }
                  }

                  // Click row to select
                  MouseArea {
                    anchors.left: parent.left
                    anchors.right: parent.children[1].left
                    anchors.top: parent.top
                    anchors.bottom: parent.bottom
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                      root.selectedAsset = assetName
                      root.watchlistManagerOpen = false
                    }
                  }
                }
              }
            }
          }
        }

        // -------------------------------------------------------------
        // VIEW B: ASSET DETAIL TERMINAL (Main View)
        // -------------------------------------------------------------
        Column {
          id: assetDetailView
          width: parent.width
          spacing: Style.space(12)
          visible: !root.watchlistManagerOpen

          // 2. Asset Header (Symbol, Name, Large Formatted Price, 24h Change Pill, + Add to Watchlist action)
          Row {
            width: parent.width
            spacing: Style.space(12)

            Column {
              width: parent.width - changePill.width - Style.space(12)
              spacing: Style.space(2)

              Row {
                spacing: Style.space(6)
                Text {
                  text: root.activeQuote.symbol
                  font.family: Style.font.family
                  font.pixelSize: Style.font.caption
                  font.bold: true
                  color: Color.muted
                }
                Text {
                  text: "• " + root.activeQuote.name
                  font.family: Style.font.family
                  font.pixelSize: Style.font.caption
                  color: Color.muted
                }

                // "+ Add to Watchlist" button on detail panel if not in watchlist
                BorderSurface {
                  visible: !root.isSelectedInWatchlist && root.assets.length < 20
                  implicitWidth: addDetailText.implicitWidth + Style.space(8)
                  implicitHeight: Style.space(18)
                  radius: Style.space(3)
                  color: Style.selectionFillAlpha
                  borderSpec: Border.flat(Color.accent, 1)

                  Text {
                    id: addDetailText
                    anchors.centerIn: parent
                    text: "+ Add to Watchlist"
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                    font.bold: true
                    color: Color.accent
                  }

                  MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: {
                      if (root.marketService) root.marketService.addMarket(root.selectedAsset)
                    }
                  }
                }
              }

              Text {
                text: MarketModel.formatPrice(root.activeQuote.price)
                font.family: Style.font.family
                font.pixelSize: Style.space(24)
                font.bold: true
                color: Color.foreground
              }
            }

            // 24h Change & Freshness Pill
            BorderSurface {
              id: changePill
              anchors.verticalCenter: parent.verticalCenter
              implicitWidth: pillColumn.implicitWidth + Style.space(14)
              implicitHeight: pillColumn.implicitHeight + Style.space(8)
              radius: Style.cornerRadius
              color: root.activeQuote.change24h >= 0 ? Qt.rgba(0.15, 0.65, 0.60, 0.15) : Qt.rgba(0.93, 0.32, 0.31, 0.15)
              borderSpec: Border.flat(root.activeQuote.change24h >= 0 ? "#26a69a" : "#ef5350", 1)

              Column {
                id: pillColumn
                anchors.centerIn: parent
                spacing: Style.space(2)

                Row {
                  anchors.horizontalCenter: parent.horizontalCenter
                  spacing: Style.space(4)

                  Text {
                    text: root.activeQuote.change24h >= 0 ? "▲" : "▼"
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                    color: root.activeQuote.change24h >= 0 ? "#26a69a" : "#ef5350"
                  }

                  Text {
                    text: MarketModel.formatPercentage(root.activeQuote.change24h)
                    font.family: Style.font.family
                    font.pixelSize: Style.font.body
                    font.bold: true
                    color: root.activeQuote.change24h >= 0 ? "#26a69a" : "#ef5350"
                  }
                }

                Text {
                  anchors.horizontalCenter: parent.horizontalCenter
                  text: root.activeQuote.freshness
                  font.family: Style.font.family
                  font.pixelSize: Style.font.caption
                  font.bold: true
                  color: root.activeQuote.freshness === "LIVE" ? "#26a69a" : (root.activeQuote.freshness === "STALE" ? "#fbc02d" : "#ef5350")
                }
              }
            }
          }

          PanelSeparator { width: parent.width }

          // 3. Sparkline Chart + Timeframe Selector
          Column {
            width: parent.width
            spacing: Style.space(6)

            Row {
              width: parent.width

              Text {
                text: "PRICE ACTION"
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                font.bold: true
                color: Color.muted
              }

              Item { width: Math.max(1, parent.width - parent.children[0].width - tfRow.width); height: 1 }

              Row {
                id: tfRow
                spacing: Style.space(4)

                Repeater {
                  model: ["1H", "4H", "1D", "1W"]

                  Item {
                    id: tfItem
                    width: Style.space(30)
                    height: Style.space(22)

                    readonly property bool isSelected: root.selectedTimeframe === modelData
                    HoverHandler { id: tfHover }

                    BorderSurface {
                      anchors.fill: parent
                      radius: Style.cornerRadius
                      color: tfItem.isSelected ? Style.selectionFillAlpha : (tfHover.hovered ? Style.hoverFillAlpha : "transparent")
                      borderSpec: Border.controlSpec(tfItem.isSelected ? "selected" : (tfHover.hovered ? "hover" : "normal"), Color.foreground, Color.accent)

                      Text {
                        anchors.centerIn: parent
                        text: modelData
                        font.family: Style.font.family
                        font.pixelSize: Style.font.caption
                        font.bold: tfItem.isSelected
                        color: tfItem.isSelected ? Color.accent : (tfHover.hovered ? Color.foreground : Util.alpha(Color.foreground, 0.8))
                      }

                      MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.selectedTimeframe = modelData
                      }
                    }
                  }
                }
              }
            }

            SparklineChart {
              width: parent.width
              height: Style.space(110)
              points: root.activeCandles
              isPositive: root.activeQuote.change24h >= 0
            }
          }

          PanelSeparator { width: parent.width }

          // 4. 24H Key Statistics
          Row {
            width: parent.width

            Column {
              width: parent.width / 3
              spacing: Style.space(2)
              Text { text: "24H HIGH"; font.pixelSize: Style.font.caption; font.bold: true; color: Color.muted }
              Text { text: MarketModel.formatPrice(root.activeQuote.high24h); font.pixelSize: Style.font.body; font.bold: true; color: Color.foreground }
            }

            Column {
              width: parent.width / 3
              spacing: Style.space(2)
              Text { text: "24H LOW"; font.pixelSize: Style.font.caption; font.bold: true; color: Color.muted }
              Text { text: MarketModel.formatPrice(root.activeQuote.low24h); font.pixelSize: Style.font.body; font.bold: true; color: Color.foreground }
            }

            Column {
              width: parent.width / 3
              spacing: Style.space(2)
              Text { text: "24H VOLUME"; font.pixelSize: Style.font.caption; font.bold: true; color: Color.muted }
              Text { text: MarketModel.formatVolume(root.activeQuote.volume24h); font.pixelSize: Style.font.body; font.bold: true; color: Color.foreground }
            }
          }

          PanelSeparator { width: parent.width }

          // 5. Multi-Exchange Comparison Table
          Column {
            width: parent.width
            spacing: Style.space(6)

            Text {
              text: "EXCHANGES & MARKETS"
              font.family: Style.font.family
              font.pixelSize: Style.font.caption
              font.bold: true
              color: Color.muted
            }

            // Exchange Rows
            Column {
              width: parent.width
              spacing: Style.space(5)

              // Yahoo Row (for Stocks)
              Item {
                width: parent.width
                height: yahooLeft.implicitHeight
                visible: root.isStock

                Row {
                  id: yahooLeft
                  anchors.left: parent.left
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.space(6)
                  Rectangle {
                    width: Style.space(8); height: Style.space(8); radius: Style.space(4)
                    anchors.verticalCenter: parent.verticalCenter
                    color: root.yahooQuote ? "#26a69a" : Color.muted
                  }
                  Text {
                    text: "Yahoo (" + (root.activeQuote.marketState === "regular" ? "Regular" : (root.activeQuote.marketState === "preMarket" ? "Pre-Mkt" : (root.activeQuote.marketState === "postMarket" ? "Post-Mkt" : "Closed"))) + ")"
                    width: Style.space(120)
                    font.pixelSize: Style.font.caption
                    color: Color.foreground
                    anchors.verticalCenter: parent.verticalCenter
                  }
                  Text {
                    text: root.yahooQuote ? MarketModel.formatPrice(root.yahooQuote.price) : "--"
                    font.pixelSize: Style.font.caption; font.bold: true; color: Color.foreground
                    anchors.verticalCenter: parent.verticalCenter
                  }
                }

                Text {
                  anchors.right: parent.right
                  anchors.verticalCenter: parent.verticalCenter
                  text: root.yahooQuote ? MarketModel.formatPercentage(root.yahooQuote.change24h) : ""
                  font.pixelSize: Style.font.caption
                  color: (root.yahooQuote && root.yahooQuote.change24h >= 0) ? "#26a69a" : "#ef5350"
                }
              }

              // Binance Row (for Crypto)
              Item {
                width: parent.width
                height: binanceLeft.implicitHeight
                visible: !root.isStock
                
                Row {
                  id: binanceLeft
                  anchors.left: parent.left
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.space(6)
                  Rectangle {
                    width: Style.space(8); height: Style.space(8); radius: Style.space(4)
                    anchors.verticalCenter: parent.verticalCenter
                    color: root.binanceQuote ? "#26a69a" : Color.muted
                  }
                  Text { text: "Binance (Spot)"; width: Style.space(110); font.pixelSize: Style.font.caption; color: Color.foreground; anchors.verticalCenter: parent.verticalCenter }
                  Text {
                    text: root.binanceQuote ? MarketModel.formatPrice(root.binanceQuote.price) : "--"
                    font.pixelSize: Style.font.caption; font.bold: true; color: Color.foreground
                    anchors.verticalCenter: parent.verticalCenter
                  }
                }
                
                Text {
                  anchors.right: parent.right
                  anchors.verticalCenter: parent.verticalCenter
                  text: root.binanceQuote ? MarketModel.formatPercentage(root.binanceQuote.change24h) : ""
                  font.pixelSize: Style.font.caption
                  color: (root.binanceQuote && root.binanceQuote.change24h >= 0) ? "#26a69a" : "#ef5350"
                }
              }

              // Coinbase Row (for Crypto)
              Item {
                width: parent.width
                height: coinbaseLeft.implicitHeight
                visible: !root.isStock
                
                Row {
                  id: coinbaseLeft
                  anchors.left: parent.left
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.space(6)
                  Rectangle {
                    width: Style.space(8); height: Style.space(8); radius: Style.space(4)
                    anchors.verticalCenter: parent.verticalCenter
                    color: root.coinbaseQuote ? "#26a69a" : Color.muted
                  }
                  Text { text: "Coinbase (Spot)"; width: Style.space(110); font.pixelSize: Style.font.caption; color: Color.foreground; anchors.verticalCenter: parent.verticalCenter }
                  Text {
                    text: root.coinbaseQuote ? MarketModel.formatPrice(root.coinbaseQuote.price) : "--"
                    font.pixelSize: Style.font.caption; font.bold: true; color: Color.foreground
                    anchors.verticalCenter: parent.verticalCenter
                  }
                }
                
                Text {
                  anchors.right: parent.right
                  anchors.verticalCenter: parent.verticalCenter
                  text: root.coinbaseQuote ? MarketModel.formatPercentage(root.coinbaseQuote.change24h) : ""
                  font.pixelSize: Style.font.caption
                  color: (root.coinbaseQuote && root.coinbaseQuote.change24h >= 0) ? "#26a69a" : "#ef5350"
                }
              }

              // Hyperliquid Row (for Crypto)
              Item {
                width: parent.width
                height: hyperliquidLeft.implicitHeight
                visible: !root.isStock
                
                Row {
                  id: hyperliquidLeft
                  anchors.left: parent.left
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.space(6)
                  Rectangle {
                    width: Style.space(8); height: Style.space(8); radius: Style.space(4)
                    anchors.verticalCenter: parent.verticalCenter
                    color: root.hyperliquidQuote ? "#26a69a" : Color.muted
                  }
                  Text { text: "Hyperliquid (Perp)"; width: Style.space(110); font.pixelSize: Style.font.caption; color: Color.foreground; anchors.verticalCenter: parent.verticalCenter }
                  Text {
                    text: root.hyperliquidQuote ? MarketModel.formatPrice(root.hyperliquidQuote.price) : "--"
                    font.pixelSize: Style.font.caption; font.bold: true; color: Color.foreground
                    anchors.verticalCenter: parent.verticalCenter
                  }
                }
                
                Text {
                  anchors.right: parent.right
                  anchors.verticalCenter: parent.verticalCenter
                  text: root.hyperliquidQuote ? MarketModel.formatPercentage(root.hyperliquidQuote.change24h) : ""
                  font.pixelSize: Style.font.caption
                  color: (root.hyperliquidQuote && root.hyperliquidQuote.change24h >= 0) ? "#26a69a" : "#ef5350"
                }
              }
            }
          }
        }
      }
    }
  }
}
