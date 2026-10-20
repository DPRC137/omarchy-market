import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.Commons
import "../models/MarketModel.js" as MarketModel

AbstractButton {
  id: root
  objectName: "watch-" + asset
  required property string asset
  required property var quote
  property bool selected: false
  readonly property var quoteData: quote || MarketModel.createEmptyQuote(asset)
  readonly property var catalog: MarketModel.getCatalogItem(asset)
  activeFocusOnTab: true
  implicitHeight: content.implicitHeight + Style.space(24)
  Accessible.role: Accessible.Button
  Accessible.name: asset + ", " + name.text + ", " + price.text + ", " + change.text + ", " + status.text
  MarketTokens { id: tokens }
  background: Rectangle {
    color: root.hovered || root.down || root.selected ? tokens.hover : "transparent"
    border.width: root.activeFocus ? 2 : 0
    border.color: tokens.accent
    Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: tokens.divider }
  }
  ColumnLayout {
    id: content
    anchors.left: parent.left; anchors.right: parent.right; anchors.verticalCenter: parent.verticalCenter
    anchors.margins: Style.space(10)
    spacing: Style.space(4)
    GridLayout {
      columns: root.width < ticker.implicitWidth + price.implicitWidth + Style.space(32) ? 1 : 2
      Layout.fillWidth: true
      Text {
        id: ticker
        Layout.fillWidth: true; Layout.preferredWidth: 1
        text: root.asset
        font.family: Style.font.family; font.pixelSize: Style.font.body; font.bold: true
        color: tokens.foreground; elide: Text.ElideRight; textFormat: Text.PlainText
      }
      Text {
        id: price
        Layout.fillWidth: true; Layout.preferredWidth: 2
        horizontalAlignment: parent.columns === 1 ? Text.AlignLeft : Text.AlignRight; elide: Text.ElideRight
        text: MarketModel.formatPrice(root.quoteData.price, undefined, root.quoteData.currency)
        font.family: Style.font.family; font.pixelSize: Style.font.body; font.bold: true; color: tokens.foreground
      }
    }
    RowLayout {
      Layout.fillWidth: true
      Text {
        id: name
        Layout.fillWidth: true; Layout.preferredWidth: 1
        text: root.catalog ? root.catalog.name : root.asset
        font.family: Style.font.family; font.pixelSize: Style.font.caption
        color: tokens.muted; elide: Text.ElideRight; textFormat: Text.PlainText
      }
      Text {
        id: change
        text: MarketModel.formatPercentage(root.quoteData.change24h)
        font.family: Style.font.family; font.pixelSize: Style.font.bodySmall
        color: root.quoteData.change24h === null || root.quoteData.change24h === undefined ? tokens.muted : root.quoteData.change24h >= 0 ? tokens.positive : tokens.negative
      }
    }
    Text {
      id: status
      Layout.fillWidth: true
      text: root.quoteData.freshness === "UNAVAILABLE" ? "Awaiting quote" : root.quoteData.freshness + " · " + (root.quoteData.currency || "Currency unavailable") + (root.quoteData.assetClass === "stock" ? " · vs prev. close · " + (root.quoteData.marketState || "UNKNOWN") : " · 24h")
      font.family: Style.font.family; font.pixelSize: Style.font.caption
      color: tokens.muted; elide: Text.ElideRight; textFormat: Text.PlainText
    }
  }
}
