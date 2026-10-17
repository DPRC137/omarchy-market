import QtQuick
import QtQuick.Controls
import qs.Commons
import qs.Ui
import "../models/MarketModel.js" as MarketModel

AbstractButton {
  id: root
  objectName: "watch-" + asset
  required property string asset
  required property var quote
  property bool selected: false
  activeFocusOnTab: true
  implicitHeight: Style.space(48)
  Accessible.name: asset + ", " + price.text + ", " + change.text + ", " + age.text
  background: BorderSurface {
    radius: Style.cornerRadius
    color: root.hovered ? Style.hoverFillAlpha : Style.normalFillAlpha
    borderSpec: Border.controlSpec(root.activeFocus || root.selected ? "selected" : "normal", Color.foreground, Color.accent)
  }
  Text {
    x: Style.space(10); y: Style.space(7)
    width: parent.width * 0.3
    text: root.asset
    font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; font.bold: true
    color: Color.foreground; elide: Text.ElideRight; textFormat: Text.PlainText
  }
  Text {
    id: age
    x: Style.space(10); y: Style.space(27)
    text: root.quote.freshness
    font.family: Style.font.family; font.pixelSize: Style.font.caption
    color: root.quote.freshness === "LIVE" || root.quote.freshness === "CURRENT" ? "#26a69a" : Color.muted
  }
  Text {
    id: price
    anchors.right: parent.right; anchors.rightMargin: Style.space(10); y: Style.space(7)
    width: parent.width * 0.65; horizontalAlignment: Text.AlignRight; elide: Text.ElideRight
    text: MarketModel.formatPrice(root.quote.price, undefined, root.quote.currency)
    font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; color: Color.foreground
  }
  Text {
    id: change
    anchors.right: parent.right; anchors.rightMargin: Style.space(10); y: Style.space(27)
    text: MarketModel.formatPercentage(root.quote.change24h)
    font.family: Style.font.family; font.pixelSize: Style.font.caption
    color: root.quote.change24h === null ? Color.muted : root.quote.change24h >= 0 ? "#26a69a" : "#ef5350"
  }
}
