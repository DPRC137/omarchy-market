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
  property var assets: ["BTC", "ETH", "SOL", "HYPE"]

  readonly property var marketService: (bar && bar.shell) ? bar.shell.serviceFor("io.github.dpr.omarchy-market") : null
  readonly property var activeQuote: marketService ? marketService.getQuote(selectedAsset, "aggregate") : MarketModel.createEmptyQuote(selectedAsset, "aggregate")
  readonly property var binanceQuote: marketService ? marketService.getProviderQuote(selectedAsset, "binance") : null
  readonly property var coinbaseQuote: marketService ? marketService.getProviderQuote(selectedAsset, "coinbase") : null
  readonly property var hyperliquidQuote: marketService ? marketService.getProviderQuote(selectedAsset, "hyperliquid") : null
  readonly property var activeCandles: marketService ? marketService.getCandles(selectedAsset, selectedTimeframe) : []

  function open() {
    root.controller.show()
    if (marketService) {
      marketService.refresh()
      marketService.fetchCandles(selectedAsset, selectedTimeframe)
    }
  }

  function close() {
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  onSelectedAssetChanged: {
    if (marketService) marketService.fetchCandles(selectedAsset, selectedTimeframe)
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
    Component.onCompleted: console.log("KeyboardPanel padding is: " + keyboardPanel.padding + ", contentHeight is: " + contentHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) {
        var idx = root.assets.indexOf(root.selectedAsset)
        if (idx !== -1) {
          var nextIdx = (idx + direction + root.assets.length) % root.assets.length
          root.selectedAsset = root.assets[nextIdx]
        }
      }
      onTextKey: function(t) {
        if (t === "r" || t === "R") {
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

        // 1. Asset Switcher Tabs
        Row {
          width: parent.width
          spacing: Style.space(6)

          Repeater {
            model: root.assets

            Item {
              id: tabItem
              width: (contentColumn.width - (root.assets.length - 1) * Style.space(6)) / root.assets.length
              height: Style.space(30)

              readonly property bool isCurrent: root.selectedAsset === modelData
              readonly property var def: MarketModel.ASSET_DEFINITIONS[modelData] || { icon: "", name: modelData }

              HoverHandler { id: tabHover }

              BorderSurface {
                anchors.fill: parent
                radius: Style.cornerRadius
                color: tabItem.isCurrent ? Style.selectionFillAlpha : (tabHover.hovered ? Style.hoverFillAlpha : Style.normalFillAlpha)
                borderSpec: Border.controlSpec(tabItem.isCurrent ? "selected" : (tabHover.hovered ? "hover" : "normal"), Color.foreground, Color.accent)

                Row {
                  anchors.centerIn: parent
                  spacing: Style.space(5)

                  Text {
                    text: tabItem.def.icon
                    font.family: Style.font.family
                    font.pixelSize: Style.font.body
                    font.bold: true
                    color: tabItem.isCurrent ? Color.accent : (tabHover.hovered ? Color.foreground : Util.alpha(Color.foreground, 0.8))
                  }

                  Text {
                    text: modelData
                    font.family: Style.font.family
                    font.pixelSize: Style.font.bodySmall
                    font.bold: tabItem.isCurrent
                    color: tabItem.isCurrent ? Color.foreground : (tabHover.hovered ? Color.foreground : Util.alpha(Color.foreground, 0.85))
                  }
                }

                MouseArea {
                  anchors.fill: parent
                  cursorShape: Qt.PointingHandCursor
                  onClicked: root.selectedAsset = modelData
                }
              }
            }
          }
        }

        // 2. Asset Header (Symbol, Name, Large Formatted Price, 24h Change Pill)
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
            points: root.activeCandles.length > 0 ? root.activeCandles : (root.activeQuote.price > 0 ? [root.activeQuote.low24h || root.activeQuote.price * 0.98, root.activeQuote.price, root.activeQuote.high24h || root.activeQuote.price * 1.02] : [])
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

            // Binance Row
            Item {
              width: parent.width
              height: binanceLeft.implicitHeight
              
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

            // Coinbase Row
            Item {
              width: parent.width
              height: coinbaseLeft.implicitHeight
              
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

            // Hyperliquid Row
            Item {
              width: parent.width
              height: hyperliquidLeft.implicitHeight
              
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
