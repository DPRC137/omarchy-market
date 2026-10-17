import QtQuick
import "../models/RequestQueue.js" as RequestQueue

QtObject {
  id: root
  property int spacing: 0
  property var scheduler: null
  property bool busy: false
  property Timer clock: Timer {
    interval: 100
    repeat: true
    running: root.busy
    onTriggered: { root.scheduler.pump(); root.busy = root.scheduler.hasWork() }
  }

  function ensureScheduler() {
    if (!scheduler) scheduler = RequestQueue.create(start, Date.now, spacing, 24)
  }
  function enqueue(request, callback) {
    ensureScheduler()
    var accepted = scheduler.enqueue(request, callback)
    busy = scheduler.hasWork()
    return accepted
  }
  function cancel(predicate) {
    if (scheduler) { scheduler.cancel(predicate); busy = scheduler.hasWork() }
  }
  function start(request, done) {
    var xhr = new XMLHttpRequest()
    var finished = false
    function complete(result) {
      if (finished) return
      finished = true
      done(result)
    }
    xhr.onreadystatechange = function() {
      if (finished) return
      var maxBytes = request.maxBytes || 1048576
      // QML responseText is UTF-16. Bound UTF-8 bytes conservatively, including when
      // Content-Length is absent or compressed. DONE is checked again before JSON.
      if (xhr.readyState >= XMLHttpRequest.HEADERS_RECEIVED) {
        var length = Number(xhr.getResponseHeader("Content-Length"))
        if (length > maxBytes || (xhr.responseText || "").length * 3 > maxBytes) {
          complete({ error: "Response too large" }); xhr.abort(); return
        }
      }
      if (xhr.readyState !== XMLHttpRequest.DONE) return
      if (xhr.status !== 200) {
        complete({ error: "HTTP " + xhr.status, retryable: xhr.status === 0 || xhr.status === 429 || xhr.status >= 500 }); return
      }
      try { complete({ data: JSON.parse(xhr.responseText) }) }
      catch (e) { complete({ error: "Invalid JSON" }) }
    }
    xhr.open(request.body ? "POST" : "GET", request.url)
    if (request.body) xhr.setRequestHeader("Content-Type", "application/json")
    xhr.send(request.body || "")
    return function() { finished = true; xhr.abort() }
  }
  Component.onDestruction: if (scheduler) scheduler.stop()
}
