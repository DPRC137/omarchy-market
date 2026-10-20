import QtQuick
import QtTest
import Quickshell
import "market" as Market
import "market/models/MarketModel.js" as Model
import qs.Commons

// Deterministic visual evidence: production components, captured provider fixtures.
ShellRoot {
  id: root
  property var fixture: __FIXTURE_DATA__
  property int step: 0
  property bool busy: false
  property var shots: ["watchlist", "detail", "equity-closed", "manage", "search", "empty", "loading", "error", "single", "narrow-manage", "narrow-detail"]
  function expectedView() {
    var name = shots[step]
    return name.indexOf("manage") >= 0 || name === "search" ? "manage" : name.indexOf("watchlist") >= 0 || name === "empty" ? "watchlist" : "detail"
  }
  TestEvent { id: events }
  QtObject {
    id: service
    property var watchlist: ["BTC", "TSLA", "ETH", "HYPE"]
    property var structuredWatchlist: Model.deserializeWatchlist(JSON.stringify(watchlist))
    property int updateRevision: 0
    property double now: root.fixture.now
    property string pinnedAsset: "BTC"
    property bool rotationEnabled: false
    property bool refreshing: false
    property var removedItem: null
    property string visibleAsset: ""
    property string visibleRange: "1D"
    property string state: "ready"
    property var history: ({state: state, error: state === "unavailable" ? "Provider unavailable. Try again." : "", visible:{asset:visibleAsset, range:visibleRange}, entry:function(){if (service.visibleAsset !== "TSLA" || service.state === "loading" || service.state === "unavailable") return null; return {currency:"USD", interval:"5m", savedAt:root.fixture.now, windowLabel:"Latest regular session",sessionDate:root.fixture.sessionDate}}})
    function getQuote(asset) {
      if (asset === "TSLA") return Object.assign({},root.fixture.tsla,{marketState:"closed",freshness:"CURRENT"})
      if (asset === "BTC") return Object.assign({},root.fixture.btc,{freshness:"STALE"})
      return Model.createEmptyQuote(asset)
    }
    function getCandles(asset, range) { return asset === "TSLA" && state !== "loading" && state !== "unavailable" ? (root.shots[root.step] === "single" ? root.fixture.candles.slice(-1) : root.fixture.candles) : [] }
    function setVisibleChart(asset,range) {visibleAsset=asset;visibleRange=range;updateRevision++}
    function getProviderStatus(provider) {return "DISCONNECTED"}
    function getProviderError(provider) {return state === "unavailable" ? "Provider unavailable" : ""}
    function getProviderQuote(asset,provider) {return provider === Model.selectedProvider(asset) ? getQuote(asset) : null}
    function searchYahooMarkets(query, callback) {callback([],"")}
    function refresh() {}
    function fetchCandles(asset,range,force) {}
  }
  QtObject { id: host; function serviceFor(id) { return service } }
  QtObject {
    id: bar
    property var shell: host
    property string position: "top"
    property bool vertical: false
    property int barSize: 30
    property color barForeground: Color.foreground
    property var activePopout: null
    function requestPopout(item) {activePopout=item}
    function releasePopout(item) {activePopout=null}
  }
  PanelWindow { visible:true; implicitWidth:300; implicitHeight:30; Item {id:anchor; anchors.fill:parent} }
  Market.Panel {id:panel;bar:bar;anchorItem:anchor}
  function configure() {
    var name=shots[step]
    service.watchlist = name === "empty" ? [] : ["BTC", "TSLA", "ETH", "HYPE"]
    service.state = name === "loading" ? "loading" : name === "error" ? "unavailable" : "ready"
    panel.searchQuery=""
    if (name.indexOf("narrow")===0) {
      Style.fontBaseSize=18
      for(var i=0;i<panel.data.length;i++)if("contentWidth" in panel.data[i] && "owner" in panel.data[i]) panel.data[i].contentWidth=300
    }
    if (name.indexOf("manage")>=0 || name==="search") {panel.open();panel.view="manage";panel.searchQuery=name==="search"?"a":""}
    else if (name.indexOf("watchlist")>=0 || name==="empty") {panel.open()}
    else panel.openAsset(name==="detail"?"BTC":"TSLA")
    service.updateRevision++
  }
  Timer {interval:500;running:true;onTriggered:{Style.fontBaseSize=12;root.configure()}}
  Timer {
    interval:700;running:true;repeat:true
    onTriggered:{
      if(root.busy)return
      if (!panel.opened || panel.view !== root.expectedView()) { root.configure(); return }
      root.busy=true
      // Grab the real Quattro BorderSurface, including its background/padding.
      var card=panel.contentItem.parent.parent
      if (!card.grabToImage(function(result){
        var name=root.shots[root.step]
        if (!panel.opened || panel.view !== root.expectedView()) { root.configure(); root.busy=false; return }
        if(!result.saveToFile(Quickshell.env("MARKET_CAPTURE_DIR")+"/"+name+".png")) console.error("CAPTURE_FAIL",name)
        console.log("CAPTURE",name,card.width,card.height)
        root.step++
        if(root.step>=root.shots.length){panel.close();console.log("CAPTURE_PASS: native fixture screenshots");Qt.quit();return}
        root.configure();root.busy=false
      })) {
        console.log("CAPTURE_RETRY", root.shots[root.step], "open", panel.opened)
        root.configure(); root.busy=false
      }
    }
  }
}
