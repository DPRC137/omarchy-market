import QtQuick
import "../models/RequestQueue.js" as RequestQueue

QtObject {
  id: root
  property int spacing: 0
  property var scheduler: null
  property bool busy: false
  property Component worker: Component { FreshRequest {} }
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
    let process = worker.createObject(root, { request: request, callback: done })
    process.running = true
    return function() { process.cancel() }
  }
  Component.onDestruction: if (scheduler) scheduler.stop()
}
