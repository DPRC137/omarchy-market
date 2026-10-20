import QtQuick
import QtTest
import Quickshell
import Quickshell.Wayland
import "market/ui" as MarketUi

ShellRoot {
  id: root
  property bool failed: false
  property string originalKey: ""
  function check(condition, message) { if (!condition) { failed = true; console.error("UI_FAIL", message) } }
  TestEvent { id: events }
  PanelWindow {
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    visible: true; implicitWidth: 360; implicitHeight: 220
    MarketUi.SparklineChart { id: chart; anchors.fill: parent; interval: "5m"; currency: "USDC" }
  }
  Timer {
    interval: 300; running: true
    onTriggered: {
      root.check(!chart.hasData && chart.samples.length === 0, "Empty chart fabricated data")
      chart.points = [{ time: 1700000000000, close: 10 }]
      root.check(chart.samples.length === 1, "Single candle lost")
      root.check(Math.abs(chart.pointX(0) - (chart.plotLeft+chart.plotRight)/2) < 1, "Single candle not centered")
      chart.setHoverPosition(chart.width / 2, chart.height / 2)
      root.check(chart.hoverCandle.close === 10 && chart.hoverCandle.time === 1700000000000, "Single candle inspection mismatched")
      root.check(Math.abs(chart.hoverY - (chart.plotTop + chart.plotBottom) / 2) < 1, "Flat candle hover misplaced")
      chart.points = [{ time: 1700000000000, close: 10 }, { time: 1700000300000, close: 11 }, { time: 1700001500000, close: 12 }]
      var moves = 0, lines = 0
      chart.traceLine({moveTo: function(x,y) { moves++ }, bezierCurveTo: function(a,b,c,d,x,y) { lines++ }})
      root.check(moves === 1 && lines === 2, "Elapsed interval split the continuous price line")
      var ratio = (chart.pointX(1) - chart.plotLeft) / (chart.plotRight - chart.plotLeft)
      root.check(Math.abs(ratio - 0.2) < 0.001, "Chart concealed elapsed-time gap")
      chart.setHoverPosition(chart.pointX(1), 0)
      root.check(chart.hoverIndex === 1 && chart.hoverCandle.close === 11, "Pointer selected wrong timestamp")
      root.originalKey = chart.dataKey
      chart.points = [{ time: 1700000000000, close: 10 }, { time: 1700000300000, close: 11 }, { time: 1700001500000, close: 12 }]
      root.check(chart.dataKey === root.originalKey && chart.hoverIndex === 1, "Unchanged history reset chart inspection")
      chart.forceActiveFocus()
    }
  }
  Timer {
    interval: 600; running: true
    onTriggered: {
      events.keyClick(Qt.Key_Right, 0, 0)
      root.check(chart.hoverIndex === 2 && chart.hoverCandle.close === 12, "Right arrow inspection failed")
      events.keyClick(Qt.Key_Home, 0, 0)
      root.check(chart.hoverIndex === 0, "Home inspection failed")
      events.keyClick(Qt.Key_End, 0, 0)
      root.check(chart.hoverIndex === 2, "End inspection failed")
      chart.points = [{ time: 1700000000000, close: 10 }, null, { time: 1700000600000, close: 20 }]
      chart.setHoverPosition(chart.plotRight, 0)
      root.check(chart.samples.length === 2 && chart.hoverCandle.close === 20 && chart.hoverCandle.time === 1700000600000, "Invalid candle caused hover index mismatch")
      chart.points = [{time:1700000000000,close:10},{time:1700086400000,close:11},{time:1700432000000,close:12}]
      var moves = 0, lines = 0
      chart.traceLine({moveTo:function(x,y){moves++},bezierCurveTo:function(a,b,c,d,x,y){lines++}})
      root.check(moves === 1 && lines === 2 && chart.samples.length === 3, "Overnight/weekend curve split or invented data")
      chart.tradingSessions = true
      root.check(Math.abs((chart.pointX(1)-chart.plotLeft)/(chart.plotRight-chart.plotLeft)-0.5)<0.001,"Closed equity periods still compress trading activity into spikes")
      chart.setHoverPosition(chart.pointX(1),0)
      root.check(chart.hoverCandle.time===1700086400000 && chart.hoverCandle.close===11,"Trading axis inspection invented a timestamp or price")
      chart.points = []
      root.check(!chart.hasData && !chart.hovered && chart.hoverCandle === null, "Empty history retained stale inspection")
      if (!root.failed) console.log("UI_PASS: chart continuous overnight/weekend line, empty, single, actual timestamps, keyboard inspection, invalid points, stable data revisions")
      Qt.quit()
    }
  }
}
