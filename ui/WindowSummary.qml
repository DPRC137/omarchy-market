import QtQuick
import qs.Commons
import "../models/MarketModel.js" as MarketModel
import "../models/HistoryStats.js" as HistoryStats

Column {
  id: root
  objectName: "window-summary"
  property var points: []
  property string timeframe: "1D"
  property string currency: ""
  property string historyState: "unavailable"
  readonly property var stats: HistoryStats.summarize(points)
  readonly property color movementColor: stats.changePercent === null ? tokens.muted : stats.changePercent >= 0 ? tokens.positive : tokens.negative
  spacing: Style.space(8)
  MarketTokens { id: tokens }

  function absoluteChange(value) {
    if (value === null) return "—"
    return (value > 0 ? "+" : value < 0 ? "−" : "") + (value === 0 ? "0.00" : MarketModel.formatPrice(Math.abs(value), undefined, currency, true)) + (currency ? " " + currency : "")
  }
  function dateLabel(time) {
    return Qt.formatDateTime(new Date(time), timeframe === "1D" ? "MMM d, hh:mm" : "MMM d, yyyy")
  }
  Flow {
    width: parent.width; spacing: Style.space(8)
    Text {
      text: root.timeframe + " overview"
      font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; font.bold: true; color: tokens.foreground
    }
    Text {
      visible: root.historyState !== "ready"
      text: root.historyState === "loading" ? (root.stats.count ? "Updating cached history…" : "Loading history…") : root.historyState === "stale" ? "Cached history" : "History unavailable"
      font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted
    }
  }
  Flow {
    width: parent.width; spacing: Style.space(10)
    Text {
      objectName: "window-change"
      text: MarketModel.formatPercentage(root.stats.changePercent)
      font.family: Style.font.family; font.pixelSize: Style.font.body * 1.65; font.bold: true; color: root.movementColor
      Accessible.name: root.timeframe + " first-to-latest closing price change: " + text
    }
    Column {
      spacing: Style.space(2)
      Text {
        objectName: "window-change-amount"
        text: root.absoluteChange(root.stats.change)
        font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; color: tokens.foreground
      }
      Text {
        text: "First → latest close"
        font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted
      }
    }
  }
  Flow {
    id: metricFlow
    width: parent.width; spacing: Style.space(10)
    Repeater {
      model: [{ key: "high", label: "High close", value: root.stats.high }, { key: "low", label: "Low close", value: root.stats.low }, { key: "mean", label: "Average close", value: root.stats.mean }]
      Column {
        required property var modelData
        width: Math.floor(root.width < Style.space(330) ? (root.width - metricFlow.spacing) / 2 : (root.width - metricFlow.spacing * 2) / 3)
        spacing: Style.space(4)
        Text { text: parent.modelData.label; font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted }
        Text {
          objectName: "window-" + parent.modelData.key
          width: parent.width; wrapMode: Text.Wrap
          text: MarketModel.formatPrice(parent.modelData.value, undefined, root.currency)
          font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; color: tokens.foreground
        }
      }
    }
  }
  Text {
    objectName: "window-coverage"
    width: parent.width; wrapMode: Text.Wrap
    text: root.stats.count ? root.dateLabel(root.stats.firstTime) + " – " + root.dateLabel(root.stats.lastTime) + "\n" + root.stats.count + " observed close" + (root.stats.count === 1 ? " · More history needed for change" : "s") : "Window statistics appear when history is available."
    font.family: Style.font.family; font.pixelSize: Style.font.caption; color: tokens.muted
  }
}
