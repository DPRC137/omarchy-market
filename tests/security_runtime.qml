import QtQuick
import Quickshell
import "market/ui" as MarketUi
import "market/models/MarketModel.js" as Model

// Hostile Yahoo names must remain literal in every actual UI sink. The runner
// also verifies that the embedded image URL receives no resource requests.
ShellRoot {
  id: root
  property bool failed: false
  property int sinks: 0
  property string hostile: "<img src='" + Quickshell.env("MARKET_SECURITY_URL") + "/x'>guard-market"
  property var remote: Model.registerDynamicInstrument({asset:"GUARD",name:hostile,currency:"USD"})
  property var quote: Object.assign(Model.createEmptyQuote(remote.asset,"yahoo"), {price:123,name:remote.name,currency:"USD",assetClass:"stock"})
  function check(value,message) { if(!value) {failed=true;console.error("UI_FAIL:",message)} }
  function inspect(item) {
    if(typeof item.text === "string" && item.text.indexOf("guard-market") >= 0 && item.textFormat !== undefined) {
      sinks++
      check(item.textFormat === Text.PlainText,"remote name/error uses rich or automatic text")
    }
    for(var i=0;i<(item.children||[]).length;i++) inspect(item.children[i])
  }
  QtObject {
    id: service
    property double now: Date.now()
    property string pinnedAsset: "GUARD"
    property bool rotationEnabled: false
    property var history: ({state:"unavailable",error:root.hostile,visible:null})
    function getQuote(asset,provider) {return root.quote}
    function getProviderQuote(asset,provider) {return root.quote}
    function getCandles(asset,range) {return []}
    function getProviderStatus(provider) {return "DISCONNECTED"}
    function getProviderError(provider) {return root.hostile}
  }
  PanelWindow {
    visible:true; implicitWidth:600; implicitHeight:800
    Column {
      id: views
      width:parent.width
      MarketUi.WatchRow {width:parent.width;asset:root.remote.asset;quote:root.quote}
      MarketUi.ManageView {width:parent.width;service:service;assets:[root.remote.asset];searchResults:[root.remote];searchQuery:"GUARD"}
      MarketUi.AssetDetail {width:parent.width;service:service;asset:root.remote.asset;diagnosticsOpen:true}
    }
  }
  Timer {
    interval:700;running:true
    onTriggered: {
      root.inspect(views)
      root.check(root.sinks >= 5,"remote text sinks were not exercised")
      if(!root.failed) console.log("UI_PASS: hostile remote names and errors remain PlainText in search, watchlist, detail and diagnostics; sinks",root.sinks)
      Qt.quit()
    }
  }
}
