import QtQuick
import qs.Commons as Shell

// Palette roles follow the shell live, including text-size and theme changes.
QtObject {
  id: root
  readonly property color surface: Shell.Color.popups.background
  readonly property color foreground: Shell.Color.foreground
  readonly property color muted: readable(Shell.Color.muted)
  readonly property color accent: readable(Shell.Color.accent)
  readonly property color positive: accent
  readonly property color negative: readable(Shell.Color.urgent)
  readonly property color divider: Qt.rgba(foreground.r, foreground.g, foreground.b, 0.16)
  readonly property color hover: Qt.rgba(foreground.r, foreground.g, foreground.b, 0.07)
  function linear(v) { return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  function luminance(c) { return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b) }
  function contrast(a, b) { var x = luminance(a); var y = luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05) }
  function readable(value) {
    var c = value;
    for (var i = 0; i < 10 && contrast(c, surface) < 4.5; i++)
      c = Qt.rgba(c.r * 0.8 + foreground.r * 0.2, c.g * 0.8 + foreground.g * 0.2, c.b * 0.8 + foreground.b * 0.2, 1);
    return c;
  }
}
