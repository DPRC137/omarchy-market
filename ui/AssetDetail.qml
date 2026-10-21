import QtQuick
import qs.Commons
import qs.Commons as Shell
import qs.Ui
import "../models/MarketModel.js" as MarketModel
import "../models/History.js" as History

Column {
  id: root
  property var service: null
  property int revision: 0
  property string asset: "BTC"
  property string timeframe: "1D"
  signal timeframeSelected(string value)
  property bool comparisonOpen: false
  property bool diagnosticsOpen: false
  property bool snapshotOpen: false
  readonly property var quote: service && revision >= 0 ? service.getQuote(asset) : MarketModel.createEmptyQuote(asset)
  readonly property bool isStock: quote.assetClass === "stock"
  readonly property var candles: service && revision >= 0 ? service.getCandles(asset, timeframe) : []
  readonly property var chartEntry: service && service.history && revision >= 0 && service.history.visible && service.history.visible.asset === asset && service.history.visible.range === timeframe ? service.history.entry() : null
  readonly property string chartState: service && service.history && revision >= 0 ? service.history.state : "unavailable"
  readonly property string chartError: service && service.history && revision >= 0 ? service.history.error : ""
  readonly property string priceKind: quote.priceType === "PERP_MARK" ? "Perpetual · Mark price" : isStock ? "Regular-session price" : "Spot · Last trade"
  readonly property color movementColor: quote.change24h === null ? tokens.muted : quote.change24h >= 0 ? tokens.positive : tokens.negative
  spacing: Style.space(12)
  MarketTokens { id: tokens }
  onAssetChanged: { comparisonOpen = false; diagnosticsOpen = false; snapshotOpen = false }

  Column {
    width: parent.width; spacing: Style.space(4)
    Text {
      objectName: "detail-ticker"; width: parent.width
      text: root.asset; textFormat: Text.PlainText; elide: Text.ElideRight
      font.family: Style.font.family; font.pixelSize: Style.font.body * 1.35; font.bold: true; color: Shell.Color.foreground
    }
    Text {
      width: parent.width; wrapMode: Text.Wrap; textFormat: Text.PlainText
      text: root.quote.name + " · " + root.priceKind
      font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted
    }
  }
  Column {
    width: parent.width; spacing: Style.space(5)
    Flow {
      width: parent.width; spacing: Style.space(8)
      Text {
        id: price; objectName: "detail-price"
        width: Math.min(implicitWidth, parent.width); elide: Text.ElideRight
        text: MarketModel.formatPrice(root.quote.price, undefined, root.quote.currency, !root.isStock)
        Accessible.name: MarketModel.formatPrice(root.quote.price, undefined, root.quote.currency)
        font.family: Style.font.family; font.pixelSize: Style.font.body * 2.6; font.weight: Font.DemiBold; color: Shell.Color.foreground
      }
      Text {
        objectName: "detail-currency"; height: price.height; verticalAlignment: Text.AlignVCenter
        text: root.quote.currency || "Currency pending"
        font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; color: tokens.muted
      }
    }
    Flow {
      width: parent.width; spacing: Style.space(8)
      Text {
        objectName: "quote-change"
        text: MarketModel.formatPercentage(root.quote.change24h)
        font.family: Style.font.family; font.pixelSize: Style.font.body; font.bold: true; color: root.movementColor
      }
      Text {
        text: root.isStock ? "vs previous close" : "past 24 hours"
        font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; color: tokens.muted
      }
    }
    Text {
      width: parent.width; wrapMode: Text.Wrap
      text: MarketModel.providerDisplayName(root.quote.provider) + " · " + root.quote.freshness + (root.isStock ? " · " + root.quote.marketState : "") + " · " + MarketModel.formatAge(root.quote.providerTimestamp, root.service ? root.service.now : Date.now())
      font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted
    }
  }
  Rectangle { width: parent.width; height: 1; color: tokens.divider }
  Column {
    width: parent.width; spacing: Style.space(7)
    Row {
      width: parent.width; spacing: Style.space(4)
      Repeater {
        model: History.RANGES
        MarketAction {
          required property string modelData
          width: (parent.width - parent.spacing * 3) / 4
          text: modelData; selected: root.timeframe === modelData
          Accessible.name: modelData + " price history"
          onClicked: root.timeframeSelected(modelData)
        }
      }
    }
    SparklineChart {
      objectName: "market-chart"; width: parent.width; height: Style.space(170)
      points: root.candles; timeframe: root.timeframe; tradingSessions: root.isStock
      interval: root.chartEntry ? root.chartEntry.interval : ""
      currency: root.chartEntry ? root.chartEntry.currency : root.quote.currency || ""
      emptyText: root.chartState === "loading" ? "Loading history…" : "No price history available"
      isPositive: root.candles.length >= 2 ? root.candles[root.candles.length - 1].close >= root.candles[0].close : true
    }
    WindowSummary {
      width: parent.width
      points: root.candles; timeframe: root.timeframe; historyState: root.chartState
      currency: root.chartEntry ? root.chartEntry.currency : root.quote.currency || ""
    }
    Text {
      objectName: "history-status"; width: parent.width; wrapMode: Text.Wrap; textFormat: Text.PlainText
      text: (root.chartState === "loading" ? "Loading history…" : root.chartState === "unavailable" ? "History unavailable · " + root.chartError : root.chartState === "stale" ? "Stale cached history · " + (root.chartError || "Refresh to update") : root.candles.length === 1 ? "1 candle available; waiting for more" : root.candles.length === 0 ? "No history for this period" : "History updated " + MarketModel.formatAge(root.chartEntry ? root.chartEntry.savedAt : 0, root.service ? root.service.now : Date.now())) + (root.chartEntry && root.chartEntry.windowLabel ? "\n" + root.chartEntry.windowLabel + (root.chartEntry.sessionDate ? " · " + root.chartEntry.sessionDate : "") : "") + "\n" + "Trade closes · " + (root.chartEntry ? root.chartEntry.currency + " · " + root.chartEntry.interval : root.quote.currency || "Currency pending") + (root.isStock ? " · Trading sessions" : "") + " · Local time"
      font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted
    }
    MarketAction {
      text: "Retry history"; visible: root.chartState === "stale" || root.chartState === "unavailable"
      onClicked: if (root.service) root.service.fetchCandles(root.asset, root.timeframe, true)
    }
  }
  Rectangle { width: parent.width; height: 1; color: tokens.divider }
  Column {
    width: parent.width; spacing: Style.space(7)
    MarketAction {
      objectName: "latest-snapshot"
      width: Math.min(implicitWidth,parent.width)
      text: (root.snapshotOpen ? "▾ " : "▸ ") + (root.isStock ? "Latest regular session" : "24-hour snapshot")
      onClicked: root.snapshotOpen = !root.snapshotOpen
    }
    Flow {
      width: parent.width; spacing: Style.space(10); visible: root.snapshotOpen
      Repeater {
        model: [ { label: "High", value: MarketModel.formatPrice(root.quote.high24h, undefined, root.quote.currency) }, { label: "Low", value: MarketModel.formatPrice(root.quote.low24h, undefined, root.quote.currency) }, { label: "Volume", value: MarketModel.formatVolume(root.quote.volume24h, root.quote.volumeUnit) } ]
        Column {
          required property var modelData
          width: root.width < Style.space(330) ? (root.width - Style.space(10)) / 2 : (root.width - Style.space(20)) / 3
          spacing: Style.space(4)
          Text { text: parent.modelData.label; font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted }
          Text { width: parent.width; wrapMode: Text.Wrap; text: parent.modelData.value; font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; color: Shell.Color.foreground }
        }
      }
    }
  }
  Rectangle { width: parent.width; height: 1; color: tokens.divider }
  Column {
    width: parent.width; spacing: Style.space(6)
    MarketAction { width: Math.min(implicitWidth,parent.width); text: (root.comparisonOpen ? "▾ " : "▸ ") + "Exchange comparison"; onClicked: root.comparisonOpen = !root.comparisonOpen }
    Column {
      width: parent.width; spacing: Style.space(9); visible: root.comparisonOpen
      Repeater {
        model: root.isStock ? ["yahoo"] : ["binance", "coinbase", "hyperliquid"]
        Text {
          required property string modelData
          readonly property var providerQuote: root.service && root.revision >= 0 ? root.service.getProviderQuote(root.asset, modelData) : null
          width: root.width; wrapMode: Text.Wrap; textFormat: Text.PlainText
          text: MarketModel.providerDisplayName(modelData) + (modelData === "hyperliquid" ? " · Perpetual mark" : modelData === "yahoo" ? " · Regular session" : " · Spot last") + "\n" + (providerQuote ? MarketModel.formatPrice(providerQuote.price, undefined, providerQuote.currency) + " · " + providerQuote.currency + " · " + providerQuote.freshness + " · " + MarketModel.formatAge(providerQuote.providerTimestamp, root.service.now) : "Unavailable")
          font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted
        }
      }
    }
    MarketAction { width: Math.min(implicitWidth,parent.width); text: (root.diagnosticsOpen ? "▾ " : "▸ ") + "Source & connection"; onClicked: root.diagnosticsOpen = !root.diagnosticsOpen }
    Text {
      visible: root.diagnosticsOpen; width: parent.width; wrapMode: Text.Wrap; textFormat: Text.PlainText
      text: MarketModel.providerDisplayName(root.quote.provider) + " · " + root.quote.symbol + " · " + root.quote.priceType + "\nConnection: " + (root.service && root.revision >= 0 ? root.service.getProviderStatus(root.quote.provider) : "DISCONNECTED") + " · Received " + MarketModel.formatAge(root.quote.receivedTimestamp, root.service ? root.service.now : Date.now()) + (root.service && root.service.getProviderError(root.quote.provider) ? "\n" + root.service.getProviderError(root.quote.provider) : "") + "\nCurve joins observed closes; inspection uses recorded prices and timestamps." + (root.candles.length ? "\nHistory: " + new Date(root.candles[0].time).toLocaleString() + " – " + new Date(root.candles[root.candles.length - 1].time).toLocaleString() : "")
      font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted
    }
  }
}
