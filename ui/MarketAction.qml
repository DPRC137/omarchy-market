import QtQuick
import QtQuick.Controls
import qs.Commons

AbstractButton {
  id: root
  objectName: text
  property bool selected: false
  property string variant: "quiet"
  implicitWidth: label.implicitWidth + Style.space(20)
  implicitHeight: Math.max(Style.space(32), label.implicitHeight + Style.space(16))
  activeFocusOnTab: true
  Accessible.name: text
  Accessible.role: Accessible.Button
  MarketTokens { id: tokens }
  contentItem: Text {
    id: label
    text: root.text
    textFormat: Text.PlainText
    font.family: Style.font.family
    font.pixelSize: Style.font.bodySmall
    font.bold: root.selected || root.variant === "primary"
    color: !root.enabled ? tokens.muted : root.variant === "danger" ? tokens.negative : root.selected || root.variant === "primary" ? tokens.accent : tokens.foreground
    opacity: root.enabled ? 1 : 0.6
    horizontalAlignment: Text.AlignHCenter
    verticalAlignment: Text.AlignVCenter
    elide: Text.ElideRight
  }
  background: Rectangle {
    radius: Style.cornerRadius
    color: root.hovered || root.down || root.selected ? tokens.hover : "transparent"
    border.width: root.activeFocus ? 2 : 0
    border.color: tokens.accent
    Rectangle {
      anchors.bottom: parent.bottom; anchors.horizontalCenter: parent.horizontalCenter
      width: Math.max(0, parent.width - Style.space(16)); height: 2
      visible: root.selected; color: tokens.accent
    }
  }
}
