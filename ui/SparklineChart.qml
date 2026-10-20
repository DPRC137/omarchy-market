import QtQuick
import qs.Commons
import qs.Ui
import "../models/MarketModel.js" as MarketModel

Item {
  id: root
  property var points: []
  property bool isPositive: true
  property string currency: "USD"
  property string timeframe: "1D"
  property string interval: ""
  property string emptyText: "No history available"
  property color positiveColor: tokens.positive
  property color negativeColor: tokens.negative
  readonly property color strokeColor: samples.length < 2 ? Color.foreground : isPositive ? positiveColor : negativeColor
  property var samples: []
  property string dataKey: ""
  readonly property var numericPoints: samples.map(function(p) { return p.close })
  readonly property bool hasData: samples.length > 0
  readonly property real minVal: hasData ? Math.min.apply(null, numericPoints) : 0
  readonly property real maxVal: hasData ? Math.max.apply(null, numericPoints) : 0
  readonly property real plotLeft: Style.space(5)
  readonly property real plotRight: width - Style.space(5)
  readonly property real plotTop: Style.space(40)
  readonly property real plotBottom: height - Style.space(26)
  readonly property real expectedStep: {
    var match = /^(\d+)(m|h|d)$/.exec(interval)
    return match ? Number(match[1]) * ({ m: 60000, h: 3600000, d: 86400000 }[match[2]]) : 0
  }
  property bool hovered: false
  property int hoverIndex: -1
  readonly property var hoverCandle: hovered && hoverIndex >= 0 ? samples[hoverIndex] : null
  readonly property real hoverX: hoverCandle ? pointX(hoverIndex) : 0
  readonly property real hoverY: hoverCandle ? pointY(hoverCandle.close) : 0
  activeFocusOnTab: hasData
  Accessible.role: Accessible.Chart
  Accessible.name: "Price history in " + currency
  Accessible.description: hoverCandle ? formatCandleTime(hoverCandle.time) + ", " + MarketModel.formatPrice(hoverCandle.close, undefined, currency) : "Use left and right arrows to inspect observations"
  MarketTokens { id: tokens }

  function refreshSamples() {
    var key = JSON.stringify(points || [])
    if (key === dataKey) return
    dataKey = key
    var next = []
    for (var i = 0; points && i < points.length; i++) {
      var raw = points[i]
      var value = typeof raw === "number" ? raw : raw ? (typeof raw.close === "number" ? raw.close : raw.price) : NaN
      if (typeof value === "number" && Number.isFinite(value))
        next.push({ close: value, time: raw && Number.isFinite(raw.time) ? raw.time : 0, sourceIndex: i })
    }
    if (!next.length && activeFocus) focus = false
    samples = next
    hovered = false
    hoverIndex = -1
    canvas.requestPaint()
  }
  function pointX(index) {
    if (samples.length <= 1) return (plotLeft + plotRight) / 2
    var first = samples[0].time, last = samples[samples.length - 1].time
    var ratio = last > first && first > 0 ? (samples[index].time - first) / (last - first) : index / (samples.length - 1)
    return plotLeft + ratio * (plotRight - plotLeft)
  }
  function pointY(value) {
    return plotTop + (maxVal === minVal ? 0.5 : (maxVal - value) / (maxVal - minVal)) * Math.max(0, plotBottom - plotTop)
  }
  function formatCandleTime(ts) {
    return ts > 0 ? Qt.formatDateTime(new Date(ts), "MMM d, hh:mm") : "Observation"
  }
  function axisTime(ts) {
    return ts > 0 ? Qt.formatDateTime(new Date(ts), timeframe === "1D" ? "hh:mm" : "MMM d") : ""
  }
  function setHoverPosition(mouseX, mouseY) {
    if (!hasData) return
    var index = 0, distance = Infinity
    for (var i = 0; i < samples.length; i++) {
      var delta = Math.abs(pointX(i) - mouseX)
      if (delta < distance) { distance = delta; index = i }
    }
    hoverIndex = index; hovered = true
  }
  onPointsChanged: refreshSamples()
  onWidthChanged: canvas.requestPaint()
  onHeightChanged: canvas.requestPaint()
  onStrokeColorChanged: canvas.requestPaint()
  onExpectedStepChanged: canvas.requestPaint()
  Component.onCompleted: refreshSamples()
  Keys.onLeftPressed: { hoverIndex = Math.max(0, hovered ? hoverIndex - 1 : samples.length - 1); hovered = hasData }
  Keys.onRightPressed: { hoverIndex = Math.min(samples.length - 1, hovered ? hoverIndex + 1 : 0); hovered = hasData }
  Keys.onPressed: function(event) {
    if (event.key === Qt.Key_Home || event.key === Qt.Key_End) {
      hoverIndex = event.key === Qt.Key_Home ? 0 : samples.length - 1
      hovered = hasData; event.accepted = true
    }
  }
  onActiveFocusChanged: if (!activeFocus && !pointer.containsMouse) hovered = false

  // The price path repaints only for data, geometry or palette changes.
  // Inspection uses scene-graph items, never a full Canvas repaint.
  Canvas {
    id: canvas
    anchors.fill: parent
    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()
      ctx.clearRect(0, 0, width, height)
      if (!root.hasData) return
      ctx.strokeStyle = Qt.rgba(root.strokeColor.r, root.strokeColor.g, root.strokeColor.b, 0.14)
      ctx.lineWidth = 1
      for (var line = 0; line < 3; line++) {
        var y = root.plotTop + line * (root.plotBottom - root.plotTop) / 2
        ctx.beginPath(); ctx.moveTo(root.plotLeft, y); ctx.lineTo(root.plotRight, y); ctx.stroke()
      }
      ctx.beginPath()
      for (var i = 0; i < root.samples.length; i++) {
        var p = root.samples[i], prev = i > 0 ? root.samples[i - 1] : null
        var gap = prev && (p.sourceIndex > prev.sourceIndex + 1 || (root.expectedStep > 0 && p.time - prev.time > root.expectedStep * 1.8))
        if (i === 0 || gap) ctx.moveTo(root.pointX(i), root.pointY(p.close))
        else ctx.lineTo(root.pointX(i), root.pointY(p.close))
      }
      ctx.strokeStyle = root.strokeColor; ctx.lineWidth = Style.space(2); ctx.lineJoin = "round"; ctx.stroke()
      // Render observations bounding each gap, including isolated sessions.
      ctx.fillStyle = root.strokeColor
      for (var j = 0; j < root.samples.length; j++) {
        var current = root.samples[j]
        var beforeGap = j + 1 < root.samples.length && (root.samples[j + 1].sourceIndex > current.sourceIndex + 1 || (root.expectedStep > 0 && root.samples[j + 1].time - current.time > root.expectedStep * 1.8))
        var afterGap = j > 0 && (current.sourceIndex > root.samples[j - 1].sourceIndex + 1 || (root.expectedStep > 0 && current.time - root.samples[j - 1].time > root.expectedStep * 1.8))
        if (j === root.samples.length - 1 || beforeGap || afterGap) {
          ctx.beginPath(); ctx.arc(root.pointX(j), root.pointY(current.close), Style.space(2.5), 0, Math.PI * 2); ctx.fill()
        }
      }
    }
  }
  Rectangle {
    anchors.fill: parent; color: "transparent"; radius: Style.space(4)
    border.width: root.activeFocus ? 1 : 0; border.color: Color.accent
  }
  Text {
    anchors.centerIn: parent; width: parent.width - Style.space(24)
    visible: !root.hasData; text: root.emptyText; horizontalAlignment: Text.AlignHCenter; wrapMode: Text.Wrap
    font.family: Style.font.family; font.pixelSize: Style.font.bodySmall; color: tokens.muted
  }
  Rectangle {
    visible: root.hovered; x: root.hoverX; y: root.plotTop
    width: 1; height: Math.max(0, root.plotBottom - root.plotTop); color: Util.alpha(Color.foreground, 0.35)
  }
  Rectangle {
    visible: root.hovered; x: root.hoverX - width / 2; y: root.hoverY - height / 2
    width: Style.space(7); height: width; radius: width / 2; color: root.strokeColor
    border.width: 1; border.color: Color.background
  }
  Text {
    x: Style.space(5); y: Style.space(6); width: parent.width - Style.space(10)
    visible: root.hoverCandle !== null
    text: root.hoverCandle ? root.formatCandleTime(root.hoverCandle.time) + "  ·  " + MarketModel.formatPrice(root.hoverCandle.close, undefined, root.currency) : ""
    elide: Text.ElideRight; font.family: Style.font.family; font.pixelSize: Style.font.caption; color: Color.foreground
  }
  Row {
    anchors.left: parent.left; anchors.right: parent.right; anchors.bottom: parent.bottom
    visible: root.hasData
    Text { width: parent.width / 2; text: root.axisTime(root.hasData ? root.samples[0].time : 0); color: tokens.muted; font.family: Style.font.family; font.pixelSize: Style.font.caption }
    Text { width: parent.width / 2; horizontalAlignment: Text.AlignRight; text: root.samples.length > 1 ? root.axisTime(root.samples[root.samples.length - 1].time) : "1 observation"; color: tokens.muted; font.family: Style.font.family; font.pixelSize: Style.font.caption }
  }
  MouseArea {
    id: pointer; anchors.fill: parent; hoverEnabled: true; acceptedButtons: Qt.LeftButton
    onPressed: function(mouse) { root.forceActiveFocus(); root.setHoverPosition(mouse.x, mouse.y) }
    onPositionChanged: function(mouse) { root.setHoverPosition(mouse.x, mouse.y) }
    onExited: if (!root.activeFocus) root.hovered = false
  }
}
