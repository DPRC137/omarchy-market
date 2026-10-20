import QtQuick
import qs.Commons
import qs.Ui
import "../models/MarketModel.js" as MarketModel
import "../models/ChartGeometry.js" as ChartGeometry

Item {
  id: root
  property var points: []
  property bool isPositive: true
  property string currency: "USD"
  property string timeframe: "1D"
  property bool tradingSessions: false
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
  readonly property var priceScale: ChartGeometry.priceScale(minVal,maxVal)
  readonly property real priceAxisWidth: Math.max(Style.space(40), Math.max(axisMeasure.implicitWidth, closeMeasure.implicitWidth) + Style.space(10))
  readonly property real plotRight: Math.max(plotLeft + 1, width - priceAxisWidth)
  readonly property real plotTop: Style.space(40)
  readonly property real plotBottom: height - Style.space(26)
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
      if (typeof value === "number" && Number.isFinite(value) && value > 0)
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
    var ratio = !tradingSessions && last > first && first > 0 ? (samples[index].time - first) / (last - first) : index / (samples.length - 1)
    return plotLeft + ratio * (plotRight - plotLeft)
  }
  // Equity observations share the plot evenly, removing overnight/weekend
  // dead space. Hover still reads the original provider timestamp and close.
  function traceLine(context) {
    if (!samples.length) return
    var geometry = samples.map(function(sample,index) { return {x:root.pointX(index),y:root.pointY(sample.close)} })
    context.moveTo(geometry[0].x, geometry[0].y)
    var segments = ChartGeometry.curveSegments(geometry)
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i]
      context.bezierCurveTo(s.x1,s.y1,s.x2,s.y2,s.x,s.y)
    }
  }
  function pointY(value) {
    return plotTop + (priceScale.max - value) / (priceScale.max - priceScale.min) * Math.max(0, plotBottom - plotTop)
  }
  function axisPrice(value) {
    return value === 0 ? (0).toFixed(priceScale.precision) : MarketModel.formatPrice(value,priceScale.precision,currency,true)
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
  onTradingSessionsChanged: canvas.requestPaint()
  onWidthChanged: canvas.requestPaint()
  onHeightChanged: canvas.requestPaint()
  onStrokeColorChanged: canvas.requestPaint()
  onPriceScaleChanged: canvas.requestPaint()
  onPlotRightChanged: canvas.requestPaint()
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
      ctx.strokeStyle = tokens.divider
      ctx.lineWidth = 1
      for (var line = 0; line < root.priceScale.ticks.length; line++) {
        var y = root.pointY(root.priceScale.ticks[line])
        ctx.beginPath(); ctx.moveTo(root.plotLeft, y); ctx.lineTo(root.plotRight, y); ctx.stroke()
      }
      ctx.beginPath()
      root.traceLine(ctx)
      ctx.strokeStyle = root.strokeColor; ctx.lineWidth = Style.space(2); ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke()
      // One endpoint, rather than dots at every overnight/weekend boundary.
      var last = root.samples.length - 1
      ctx.fillStyle = root.strokeColor
      ctx.beginPath(); ctx.arc(root.pointX(last), root.pointY(root.samples[last].close), Style.space(2.5), 0, Math.PI * 2); ctx.fill()
    }
  }
  Text { id: axisMeasure; visible:false; text: root.axisPrice(root.priceScale.max); font.family:Style.font.family; font.pixelSize:Style.font.caption }
  Text { id: closeMeasure; visible:false; text: MarketModel.formatPrice(root.maxVal,undefined,root.currency,true); font.family:Style.font.family; font.pixelSize:Style.font.caption }
  Repeater {
    model: root.hasData ? root.priceScale.ticks : []
    Text {
      required property real modelData
      x:root.plotRight + Style.space(7); y:root.pointY(modelData)-height/2
      width:root.priceAxisWidth-Style.space(7)
      text:root.axisPrice(modelData); elide:Text.ElideRight
      font.family:Style.font.family; font.pixelSize:Style.font.caption; color:tokens.muted
    }
  }
  Rectangle {
    visible:root.hovered; x:root.plotLeft; y:root.hoverY
    width:root.plotRight-root.plotLeft; height:1; color:Util.alpha(Color.foreground,0.35)
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
    Text { width: root.plotRight / 3; text: root.axisTime(root.hasData ? root.samples[0].time : 0); color: tokens.muted; font.family: Style.font.family; font.pixelSize: Style.font.caption }
    Text { width: root.plotRight / 3; horizontalAlignment: Text.AlignHCenter; text: root.samples.length > 2 ? root.axisTime(root.samples[Math.floor(root.samples.length / 2)].time) : ""; color: tokens.muted; font.family: Style.font.family; font.pixelSize: Style.font.caption }
    Text { width: root.plotRight / 3; horizontalAlignment: Text.AlignRight; text: root.samples.length > 1 ? root.axisTime(root.samples[root.samples.length - 1].time) : "1 observation"; color: tokens.muted; font.family: Style.font.family; font.pixelSize: Style.font.caption }
  }
  MouseArea {
    id: pointer; anchors.fill: parent; hoverEnabled: true; acceptedButtons: Qt.LeftButton
    onPressed: function(mouse) { root.forceActiveFocus(); root.setHoverPosition(mouse.x, mouse.y) }
    onPositionChanged: function(mouse) { root.setHoverPosition(mouse.x, mouse.y) }
    onExited: if (!root.activeFocus) root.hovered = false
  }
}
