import QtQuick
import qs.Commons
import qs.Ui
import "../models/MarketModel.js" as MarketModel

Item {
  id: root

  property var points: [] // Array of numbers or { close: number, ... }
  property bool isPositive: true
  property color positiveColor: "#26a69a"
  property color negativeColor: "#ef5350"

  readonly property color strokeColor: isPositive ? positiveColor : negativeColor
  readonly property var numericPoints: {
    var arr = []
    if (!points || points.length === 0) return [0, 0]
    for (var i = 0; i < points.length; i++) {
      var raw = points[i]
      var num = NaN
      if (typeof raw === "number") {
        num = raw
      } else if (raw && typeof raw.close === "number") {
        num = raw.close
      } else if (raw && typeof raw.price === "number") {
        num = raw.price
      }
      if (typeof num === "number" && Number.isFinite(num) && !isNaN(num)) {
        arr.push(num)
      }
    }
    return arr.length >= 2 ? arr : (arr.length === 1 ? [arr[0], arr[0]] : [0, 0])
  }

  readonly property real minVal: {
    var min = Infinity
    for (var i = 0; i < numericPoints.length; i++) {
      var v = numericPoints[i]
      if (typeof v === "number" && Number.isFinite(v) && v < min) min = v
    }
    return min === Infinity ? 0 : min
  }

  readonly property real maxVal: {
    var max = -Infinity
    for (var i = 0; i < numericPoints.length; i++) {
      var v = numericPoints[i]
      if (typeof v === "number" && Number.isFinite(v) && v > max) max = v
    }
    return max === -Infinity ? 0 : max
  }

  readonly property bool hasData: numericPoints.length >= 2 && points && points.length >= 2
  opacity: hasData ? 1.0 : 0.4
  Behavior on opacity { NumberAnimation { duration: 150 } }

  // Hover inspection state
  property bool hovered: false
  property int hoverIndex: -1
  property var hoverCandle: null
  property real hoverX: 0
  property real hoverY: 0

  function formatCandleTime(ts) {
    if (!ts || ts <= 0) return "--"
    var d = new Date(ts)
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    var mon = months[d.getMonth()] || ""
    var day = d.getDate()
    var hrs = ("0" + d.getHours()).slice(-2)
    var mins = ("0" + d.getMinutes()).slice(-2)
    return mon + " " + day + ", " + hrs + ":" + mins
  }

  onPointsChanged: canvas.requestPaint()
  onWidthChanged: canvas.requestPaint()
  onHeightChanged: canvas.requestPaint()
  onIsPositiveChanged: canvas.requestPaint()

  Canvas {
    id: canvas
    anchors.fill: parent
    renderTarget: Canvas.FramebufferObject
    renderStrategy: Canvas.Threaded

    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()
      ctx.clearRect(0, 0, width, height)

      var padTop = Style.space(8)
      var padBottom = Style.space(22)
      var padLeft = Style.space(4)
      var padRight = Style.space(8)

      var drawW = width - padLeft - padRight
      var drawH = height - padTop - padBottom

      var pts = root.numericPoints
      if (!root.hasData || !pts || pts.length < 2) {
        // Render subdued flat baseline for empty/loading state (no fake bezier)
        ctx.beginPath()
        ctx.moveTo(padLeft, padTop + drawH / 2)
        ctx.lineTo(width - padRight, padTop + drawH / 2)
        ctx.strokeStyle = Util.alpha(Color.foreground, 0.15)
        ctx.lineWidth = 1
        ctx.stroke()
        return
      }

      var min = root.minVal
      var max = root.maxVal
      var range = max - min
      if (range <= 0) range = max * 0.01 || 1

      var coords = []
      for (var i = 0; i < pts.length; i++) {
        var x = padLeft + (i / (pts.length - 1)) * drawW
        var normY = (pts[i] - min) / range
        var y = padTop + (1.0 - normY) * drawH
        coords.push({ x: x, y: y })
      }

      var strokeCol = root.strokeColor
      var fillBase = Qt.rgba(strokeCol.r, strokeCol.g, strokeCol.b, 0.25)
      var fillZero = Qt.rgba(strokeCol.r, strokeCol.g, strokeCol.b, 0.0)

      // 1. Draw smooth gradient area under curve
      ctx.beginPath()
      ctx.moveTo(coords[0].x, height - padBottom)
      ctx.lineTo(coords[0].x, coords[0].y)
      for (var j = 1; j < coords.length; j++) {
        var prev = coords[j - 1]
        var curr = coords[j]
        var midX = (prev.x + curr.x) / 2
        ctx.bezierCurveTo(midX, prev.y, midX, curr.y, curr.x, curr.y)
      }
      ctx.lineTo(coords[coords.length - 1].x, height - padBottom)
      ctx.closePath()

      var grad = ctx.createLinearGradient(0, padTop, 0, height - padBottom)
      grad.addColorStop(0.0, fillBase)
      grad.addColorStop(1.0, fillZero)
      ctx.fillStyle = grad
      ctx.fill()

      // 2. Draw curve stroke
      ctx.beginPath()
      ctx.moveTo(coords[0].x, coords[0].y)
      for (var k = 1; k < coords.length; k++) {
        var p0 = coords[k - 1]
        var p1 = coords[k]
        var mx = (p0.x + p1.x) / 2
        ctx.bezierCurveTo(mx, p0.y, mx, p1.y, p1.x, p1.y)
      }
      ctx.strokeStyle = strokeCol
      ctx.lineWidth = Style.space(2)
      ctx.stroke()

      // 3. Glowing dot on last point (if not hovering)
      if (!root.hovered) {
        var last = coords[coords.length - 1]
        ctx.beginPath()
        ctx.arc(last.x, last.y, Style.space(4), 0, Math.PI * 2)
        ctx.fillStyle = strokeCol
        ctx.fill()

        ctx.beginPath()
        ctx.arc(last.x, last.y, Style.space(8), 0, Math.PI * 2)
        ctx.fillStyle = Qt.rgba(strokeCol.r, strokeCol.g, strokeCol.b, 0.35)
        ctx.fill()
      }

      // 4. Draw hover crosshair and highlighted point
      if (root.hovered && root.hoverIndex >= 0 && root.hoverIndex < coords.length) {
        var hc = coords[root.hoverIndex]

        ctx.beginPath()
        ctx.moveTo(hc.x, padTop)
        ctx.lineTo(hc.x, height - padBottom)
        ctx.strokeStyle = Util.alpha(Color.foreground, 0.3)
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.stroke()
        ctx.setLineDash([])

        ctx.beginPath()
        ctx.arc(hc.x, hc.y, Style.space(4), 0, Math.PI * 2)
        ctx.fillStyle = strokeCol
        ctx.fill()

        ctx.beginPath()
        ctx.arc(hc.x, hc.y, Style.space(8), 0, Math.PI * 2)
        ctx.fillStyle = Qt.rgba(strokeCol.r, strokeCol.g, strokeCol.b, 0.45)
        ctx.fill()
      }
    }
  }

  // Hover micro-badge tooltip
  BorderSurface {
    id: hoverBadge
    visible: root.hovered && root.hoverCandle !== null
    z: 10
    x: Math.max(Style.space(4), Math.min(parent.width - width - Style.space(4), root.hoverX - width / 2))
    y: Style.space(2)
    implicitWidth: badgeRow.implicitWidth + Style.space(12)
    implicitHeight: Style.space(20)
    radius: Style.space(3)
    color: Color.background
    borderSpec: Border.flat(Color.accent, 1)

    Row {
      id: badgeRow
      anchors.centerIn: parent
      spacing: Style.space(6)

      Text {
        text: root.formatCandleTime(root.hoverCandle ? root.hoverCandle.time : 0)
        font.family: Style.font.family
        font.pixelSize: Style.font.caption
        color: Color.muted
      }

      Text {
        text: MarketModel.formatPrice(root.hoverCandle ? (typeof root.hoverCandle.close === "number" ? root.hoverCandle.close : (root.hoverCandle.price || 0)) : 0)
        font.family: Style.font.family
        font.pixelSize: Style.font.caption
        font.bold: true
        color: Color.foreground
      }
    }
  }

  function setHoverPosition(mouseX, mouseY) {
    if (!root.hasData || !root.points || root.points.length === 0) {
      root.hovered = false
      root.hoverIndex = -1
      root.hoverCandle = null
      return
    }
    var padLeft = Style.space(4)
    var padRight = Style.space(8)
    var drawW = width - padLeft - padRight
    if (drawW <= 0) return

    var clampedX = Math.max(padLeft, Math.min(width - padRight, mouseX))
    var ratio = (clampedX - padLeft) / drawW
    var len = root.points.length
    var idx = len > 1 ? Math.round(ratio * (len - 1)) : 0
    idx = Math.max(0, Math.min(len - 1, idx))

    root.hoverIndex = idx
    root.hoverCandle = root.points[idx]
    root.hoverX = padLeft + (len > 1 ? (idx / (len - 1)) * drawW : drawW / 2)

    var min = root.minVal
    var max = root.maxVal
    var range = max - min
    if (range <= 0 || !Number.isFinite(range)) range = (Number.isFinite(max) && max > 0) ? (max * 0.01) : 1
    var padTop = Style.space(8)
    var padBottom = Style.space(22)
    var drawH = height - padTop - padBottom
    var ptVal = (root.numericPoints && root.numericPoints.length > idx) ? root.numericPoints[idx] : 0
    var normY = (Number.isFinite(ptVal) && Number.isFinite(min)) ? (ptVal - min) / range : 0.5
    if (!Number.isFinite(normY)) normY = 0.5
    root.hoverY = padTop + (1.0 - normY) * drawH

    root.hovered = true
    canvas.requestPaint()
  }

  MouseArea {
    id: hoverArea
    anchors.fill: parent
    hoverEnabled: true
    acceptedButtons: Qt.NoButton

    onPositionChanged: function(mouse) {
      root.setHoverPosition(mouse.x, mouse.y)
    }

    onExited: {
      root.hovered = false
      root.hoverIndex = -1
      root.hoverCandle = null
      canvas.requestPaint()
    }
  }

  // Min / Max labels (Clean formatted currency with high contrast)
  Row {
    anchors.left: parent.left
    anchors.right: parent.right
    anchors.bottom: parent.bottom
    anchors.leftMargin: Style.space(6)
    anchors.rightMargin: Style.space(6)

    Text {
      text: "L: " + (root.minVal > 0 ? MarketModel.formatPrice(root.minVal) : "--")
      font.family: Style.font.family
      font.pixelSize: Style.font.caption
      font.bold: true
      color: Util.alpha(Color.foreground, 0.75)
    }

    Item { width: Math.max(1, parent.width - parent.children[0].width - parent.children[2].width); height: 1 }

    Text {
      text: "H: " + (root.maxVal > 0 ? MarketModel.formatPrice(root.maxVal) : "--")
      font.family: Style.font.family
      font.pixelSize: Style.font.caption
      font.bold: true
      color: Util.alpha(Color.foreground, 0.75)
    }
  }
}
