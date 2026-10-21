import QtQuick
import Quickshell
import MarketTestTrust 1.0
import "market/providers"

ShellRoot {
  id: root
  property bool failed: false
  property bool recovered: false
  property bool bootRecovered: false
  property string base: Quickshell.env("MARKET_TEST_URL")
  HttpClient { id: http }
  HttpClient { id: boot }
  HttpClient { id: cancelled }
  function check(value, message) {
    if (!value) { failed = true; console.error("RECOVERY_FAIL:", message); Qt.quit() }
  }
  function finish() {
    if (!failed && recovered && bootRecovered) {
      console.log("HTTP_RECOVERY_PASS: black-holed HTTP/2, fresh subsequent GET/POST, cancellation, parent cleanup and offline startup")
      Qt.quit()
    }
  }
  function afterRecovery(result) {
    check(result.data && result.data.value === 42, "retries reused the dead connection")
    if (failed) return
    http.enqueue({key:"post", url:base+"/post",body:"{\"type\":\"candleSnapshot\"}"}, function(reply) {
      check(reply.data && reply.data.method === "POST" && reply.data.body === "{\"type\":\"candleSnapshot\"}", "POST recovery changed the request")
      if (failed) return
      http.enqueue({key:"cancel",url:base+"/hang",timeout:5000}, function(cancelledReply) {
        check(cancelledReply.cancelled, "worker cancellation did not finalize")
      })
      cancelWorker.start()
    })
  }
  Timer {
    id: broken; interval:500
    onTriggered: http.enqueue({key:"recover",url:root.base+"/recover",timeout:1000}, root.afterRecovery)
  }
  Timer {
    id: cancelWorker; interval:500
    onTriggered: {
      http.cancel(function(r) { return r.key === "cancel" })
      http.enqueue({key:"after-cancel",url:root.base+"/after-cancel"},function(reply) {
        root.check(reply.data && reply.data.value === 42,"cancelled worker poisoned a later request")
        root.recovered=true; root.finish()
      })
    }
  }
  Timer {
    interval:100; running:true
    onTriggered: {
      cancelled.cancel(function() { return true })
      root.check(!cancelled.busy,"manual cancellation left work queued")
    }
  }
  Component.onCompleted: {
    // Poison the host's shared Qt pool as another shell plugin could. The
    // production client must work independently of this established session.
    var xhr = new XMLHttpRequest()
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== XMLHttpRequest.DONE) return
      root.check(xhr.status === 200, "HTTP/2 warm-up failed")
      if (!root.failed) broken.start()
    }
    xhr.open("GET", base + "/warm"); xhr.send()

    boot.enqueue({key:"boot",url:Quickshell.env("MARKET_BOOT_URL")+"/boot"},function(reply) {
      check(reply.data && reply.data.value===42,"offline startup did not recover")
      bootRecovered=true; finish()
    })
    cancelled.enqueue({key:"manual",url:base+"/hang",timeout:5000},function(reply) {
      check(reply.cancelled,"manual cancellation lost callback")
    })
  }
  Timer { interval:25000;running:true;onTriggered:{console.error("RECOVERY_FAIL: harness deadline");Qt.quit()} }
}
