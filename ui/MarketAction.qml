import QtQuick
import QtQuick.Controls
import qs.Commons
import qs.Ui

AbstractButton {
  id: root
  objectName: text
  property bool selected: false
  implicitWidth: label.implicitWidth + Style.space(18)
  implicitHeight: Style.space(30)
  activeFocusOnTab: true
  Accessible.name: text
  contentItem: Text {
    id: label
    text: root.text
    textFormat: Text.PlainText
    font.family: Style.font.family
    font.pixelSize: Style.font.bodySmall
    color: root.enabled ? Color.foreground : Color.muted
    horizontalAlignment: Text.AlignHCenter
    verticalAlignment: Text.AlignVCenter
    elide: Text.ElideRight
  }
  background: BorderSurface {
    radius: Style.cornerRadius
    color: root.hovered || root.down ? Style.hoverFillAlpha : Style.normalFillAlpha
    borderSpec: Border.controlSpec(root.activeFocus || root.selected ? "selected" : "normal", Color.foreground, Color.accent)
  }
}
