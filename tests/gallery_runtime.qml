import QtQuick
import QtQuick.Window
import QtTest
import Quickshell
import Quickshell.Io
import "market" as Market
import "market/models/MarketModel.js" as Model
import qs.Commons

// Presentation-only capture host. Production components and providers are intact.
ShellRoot {
  id:root
  property var assets:["BTC","ETH","SOL","AAPL","TSLA","NVDA"]
  property var shots:[Quickshell.env("MARKET_GALLERY_SHOT")]
  property int step:0
  property int ticks:0
  property int settled:0
  property bool busy:false
  property bool started:false
  property int cardWidth:600
  property int cardHeight:800
  TestEvent {id:events}
  Market.MarketService {id:service}
  QtObject {id:host;function serviceFor(id){return service}}
  QtObject {
    id:bar
    property var shell:host
    property string position:"top"
    property bool vertical:false
    property int barSize:30
    property color barForeground:Color.foreground
    property var activePopout:null
    function requestPopout(item){activePopout=item}
    function releasePopout(item){activePopout=null}
  }
  PanelWindow {visible:true;implicitWidth:300;implicitHeight:30;Item{id:anchor;anchors.fill:parent}}
  Market.Panel {id:panel;bar:bar;anchorItem:anchor}
  IpcHandler {
    target:"market-gallery"
    function captured():void {
      panel.close()
      console.log("GALLERY_PASS: fully loaded live screen, 600x800 native card")
      Qt.quit()
    }
  }
  function find(item,name){
    if(item.objectName===name)return item
    for(var i=0;i<(item.children||[]).length;i++){var match=find(item.children[i],name);if(match)return match}
    return null
  }
  function configure(){
    settled=0
    panel.searchQuery=""
    var name=shots[step]
    if(name==="aapl-month"||name==="crypto-week"||name==="equity-session"){
      panel.selectedTimeframe=name==="aapl-month"?"1M":name==="crypto-week"?"1W":"1D"
      panel.openAsset(name==="aapl-month"?"AAPL":name==="crypto-week"?"BTC":"TSLA")
    }else{
      panel.open()
      if(name!=="watchlist")panel.view="manage"
      if(name==="search")panel.searchQuery="amd"
    }
    panel.contentItem.forceActiveFocus()
  }
  function ready(){
    if(!panel.opened||service.refreshing)return false
    for(var i=0;i<assets.length;i++){
      var quote=service.getQuote(assets[i])
      if(!quote||!(quote.price>0)||(quote.freshness!=="LIVE"&&quote.freshness!=="CURRENT"))return false
    }
    if(panel.view==="detail"){
      var entry=service.history.entry(),summary=find(panel.contentItem,"window-summary")
      if(panel.chartState!=="ready"||panel.activeCandles.length<2||!entry||!summary||summary.stats.count!==panel.activeCandles.length)return false
    }
    if(shots[step]==="search"&&(panel.searchState!=="ready"||!panel.searchResults.length))return false
    if(shots[step]==="manage-actions"){
      var edit=find(panel.contentItem,"manage-edit-BTC")
      if(!edit)return false
      if(edit.text!=="Done"){
        events.mouseClick(edit,edit.width/2,edit.height/2,Qt.LeftButton,0,0)
        return false
      }
    }
    var card=panel.contentItem.parent.parent
    return card.width===cardWidth&&card.height===cardHeight&&card.opacity===1
  }
  Timer {
    interval:500;running:true
    onTriggered:{
      Style.fontBaseSize=14
      for(var i=0;i<panel.data.length;i++)if("contentWidth" in panel.data[i]&&"owner" in panel.data[i]){
        panel.data[i].contentWidth=root.cardWidth
        panel.data[i].contentHeight=root.cardHeight
      }
      service.persist(Model.deserializeWatchlist(JSON.stringify(root.assets)))
      service.pinnedAsset="BTC";service.rotationEnabled=false
      root.started=true;root.configure()
    }
  }
  Timer {
    interval:250;running:true;repeat:true
    onTriggered:{
      if(!root.started||root.busy)return
      root.ticks++
      if(root.ticks>560){console.error("GALLERY_FAIL: loading deadline",root.shots[root.step],service.refreshing,panel.chartState,panel.searchState);Qt.quit();return}
      if(!root.ready()){root.settled=0;return}
      // Require a full quiet second after all quote/history/search work finishes.
      if(++root.settled<9)return
      root.busy=true
      var card=panel.contentItem.parent.parent
      var position=card.mapToItem(card.Window.window.contentItem,0,0)
      console.log("GALLERY_READY",Math.round(position.x),Math.round(position.y),card.width,card.height)
      console.log("GALLERY_CAPTURE",root.shots[root.step],card.width,card.height,"refreshing",service.refreshing,"candles",panel.view==="detail"?panel.activeCandles.length:0)
    }
  }
}
