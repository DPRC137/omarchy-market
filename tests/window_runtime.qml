import QtQuick
import QtTest
import Quickshell
import Quickshell.Wayland
import qs.Commons
import "market/ui" as MarketUi
import "market/models/MarketModel.js" as Model

ShellRoot {
  id: root
  property bool failed: false
  function check(value, message) { if (!value) { failed=true; console.error("UI_FAIL",message) } }
  function find(item,name) {
    if(item.objectName===name)return item
    for(var i=0;i<(item.children||[]).length;i++){var next=find(item.children[i],name);if(next)return next}
    return null
  }
  function click(name) {
    var item=find(detail,name);check(item!==null,"Missing "+name)
    if(item) {
      var position=item.mapToItem(detail,0,0)
      scroller.contentY=Math.max(0,Math.min(scroller.contentHeight-scroller.height,position.y-(scroller.height-item.height)/2))
      events.mouseClick(item,item.width/2,item.height/2,Qt.LeftButton,0,0)
    }
  }
  TestEvent {id:events}
  QtObject {
    id:service
    property int updateRevision:0
    property double now:Date.UTC(2026,9,21)
    property string asset:"AAPL"
    property string range:"1D"
    property string state:"ready"
    property bool empty:false
    property bool single:false
    property var series:({"1D":[{time:1792414800000,close:100},{time:1792418400000,close:110}],"1W":[{time:1791982800000,close:80},{time:1792418400000,close:120}],"1M":[{time:1790082000000,close:200},{time:1792418400000,close:150}],"1Y":[{time:1760888400000,close:100},{time:1792418400000,close:100}]})
    property var history:({state:state,error:state==="stale"?"Provider unavailable":"",visible:{asset:asset,range:range},entry:function(){return service.empty?null:{currency:service.asset==="HYPE"?"USDC":"USD",interval:"1h",savedAt:service.now}}})
    function getQuote(asset) {return Object.assign({},Model.createEmptyQuote(asset),{price:339.19,change24h:-1.09,high24h:343.06,low24h:338.70,volume24h:23720000,freshness:"CURRENT"})}
    function getCandles(asset,range){return empty?[]:single?series[range].slice(0,1):series[range]}
    function getProviderQuote(asset,provider){return null}
    function getProviderStatus(provider){return "CONNECTED"}
    function getProviderError(provider){return ""}
    function fetchCandles(asset,range,force){}
  }
  PanelWindow {
    visible:true;implicitWidth:460;implicitHeight:760
    WlrLayershell.keyboardFocus:WlrKeyboardFocus.Exclusive
    Flickable {
      id:scroller
      anchors.fill:parent;contentHeight:detail.implicitHeight;clip:true
      MarketUi.AssetDetail {
        id:detail;width:parent.width;service:service;revision:service.updateRevision;asset:service.asset;timeframe:service.range
        onTimeframeSelected:function(value){service.range=value;service.updateRevision++}
      }
    }
  }
  Timer {
    interval:400;running:true
    onTriggered:{
      Style.fontBaseSize=14
      var summary=root.find(detail,"window-summary")
      root.check(summary.stats.changePercent===10,"1D stats ignored selected candles")
      root.check(root.find(detail,"quote-change").text==="-1.09%","Headline daily comparison changed")
      root.click("1W")
      root.check(summary.stats.changePercent===50 && summary.stats.low===80 && summary.stats.high===120,"1W stats retained daily values")
      root.click("1M")
      root.check(summary.stats.changePercent===-25 && summary.stats.mean===175,"1M stats did not update")
      root.click("1Y")
      root.check(root.find(detail,"window-change").text==="0.00%","Flat year shown as unavailable")
      root.check(root.find(detail,"window-change-amount").text==="0.00 USD","Zero absolute change shown as unavailable")
      root.check(!detail.snapshotOpen,"Daily metrics obscure selected-window summary")
      root.click("latest-snapshot")
      root.check(detail.snapshotOpen,"Daily snapshot disclosure failed")
      service.state="stale";service.updateRevision++
      root.check(summary.historyState==="stale" && summary.stats.count===2,"Stale cached stats lost or unlabelled")
      service.empty=true;service.state="loading";service.updateRevision++
      root.check(summary.stats.count===0 && summary.stats.changePercent===null,"Loading new window retained previous stats")
    }
  }
  Timer {
    interval:700;running:true
    onTriggered:{
      var summary=root.find(detail,"window-summary")
      service.state="unavailable";service.updateRevision++
      root.check(root.find(detail,"window-change").text==="—","Unavailable history fabricated a return")
      service.empty=false;service.single=true;service.state="ready";service.updateRevision++
      root.check(summary.stats.count===1 && summary.stats.changePercent===null,"Single close fabricated a return")
      service.single=false;service.asset="HYPE";service.range="1W";service.updateRevision++
      root.check(summary.currency==="USDC" && summary.stats.changePercent===50,"Perpetual window lost trade-close currency/return")
      root.check(root.find(detail,"window-change-amount").text.indexOf("USDC")>=0,"Window amount lost USDC units")
    }
  }
  Timer {
    interval:900;running:true
    onTriggered:{
      var high=root.find(detail,"window-high").parent
      var low=root.find(detail,"window-low").parent
      var mean=root.find(detail,"window-mean").parent
      root.check(high.y===low.y && low.y===mean.y,"Rounded font spacing wrapped the third window statistic")
      root.check(mean.x+mean.width<=detail.width,"Window statistic columns overflow")
      if(!root.failed)console.log("UI_PASS: selected 1D/1W/1M/1Y stats, separate daily quote/snapshot, stale/loading/missing/single history, USDC and scaled column layout")
      Qt.quit()
    }
  }
}
