import QtQuick
import Quickshell.Io

// A one-shot process owns the connection. Destruction/cancellation kills it;
// queue deadlines remain authoritative even if the worker never responds.
Process {
  id: root
  property var request
  property var callback
  property bool finished: false
  command: ["node", decodeURIComponent(Qt.resolvedUrl("../scripts/http_request.js").toString().replace("file://", ""))]
  stdinEnabled: true
  onStarted: write(JSON.stringify(request) + "\n")
  stdout: StdioCollector { id: output; waitForEnd: true }
  function complete(result) {
    if (finished) return
    finished = true
    var done = callback
    callback = null
    if (done) done(result)
    root.destroy()
  }
  function cancel() {
    if (finished) return
    finished = true
    callback = null
    running = false
    root.destroy()
  }
  onExited: function(code) {
    var result
    try {
      result = JSON.parse(output.text)
      if (!result || typeof result !== "object" || (!result.error && !("data" in result))) throw new Error("Invalid response")
    } catch (e) { result = { error: "Recovery worker failed", retryable: true } }
    root.complete(result)
  }
}
