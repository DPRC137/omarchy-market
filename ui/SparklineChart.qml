import QtQuick
import qs.Commons
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
      var val = points[i]
      if (typeof val === "number") {
        arr.push(val)
      } else if (val && typeof val.close === "number") {
        arr.push(val.close)
      } else if (val && typeof val.price === "number") {
        arr.push(val.price)
      }
    }
    return arr.length >= 2 ? arr : (arr.length === 1 ? [arr[0], arr[0]] : [0, 0])
  }

  readonly property real minVal: {
    var min = Infinity
    for (var i = 0; i < numericPoints.length; i++) {
      if (numericPoints[i] < min) min = numericPoints[i]
    }
    return min === Infinity ? 0 : min
  }

  readonly property real maxVal: {
    var max = -Infinity
    for (var i = 0; i < numericPoints.length; i++) {
      if (numericPoints[i] > max) max = numericPoints[i]
    }
    return max === -Infinity ? 0 : max
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

      var pts = root.numericPoints
      if (!pts || pts.length < 2) return

      var min = root.minVal
      var max = root.maxVal
      var range = max - min
      if (range <= 0) range = max * 0.01 || 1

      var padTop = Style.space(8)
      var padBottom = Style.space(22)
      var padLeft = Style.space(4)
      var padRight = Style.space(8)

      var drawW = width - padLeft - padRight
      var drawH = height - padTop - padBottom

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

      // 3. Glowing dot on last point
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
