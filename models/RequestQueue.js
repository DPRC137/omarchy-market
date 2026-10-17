.pragma library

// Shared production scheduler. The transport supplies start(task, done) -> abort.
// Deadlines are polled by a Qt Timer, not browser-only XHR timeout properties.
function create(start, now, spacing, limit) {
  var q = { pending: [], active: null, sequence: 0, nextAt: 0, stopped: false };
  q.hasWork = function() { return !!q.active || q.pending.length > 0; };
  function finish(task, result) {
    if (q.active !== task || task.done) return;
    task.done = true;
    q.active = null;
    q.nextAt = now() + spacing;
    if (result.retryable && task.attempt < 2 && !q.stopped) {
      task.attempt++;
      task.done = false;
      q.nextAt = now() + Math.min(30000, 2000 * Math.pow(2, task.attempt));
      if (q.pending.length >= limit) {
        var displaced = q.pending.pop();
        displaced.callback({ error: "Request superseded by retry" }, displaced.request);
      }
      q.pending.unshift(task);
    } else {
      task.callback(result, task.request);
    }
  }
  q.enqueue = function(request, callback) {
    if (q.stopped) return false;
    if ((q.active && q.active.request.key === request.key) || q.pending.some(function(t) { return t.request.key === request.key; })) return false;
    if (q.pending.length >= limit) {
      // The visible chart may displace a background quote, but never vanish silently.
      var last = q.pending[q.pending.length - 1];
      if ((request.priority || 0) <= (last.request.priority || 0)) { callback({ error: "Request queue full" }, request); return false; }
      q.pending.pop();
      last.callback({ error: "Request superseded" }, last.request);
    }
    q.pending.push({ id: ++q.sequence, request: request, callback: callback, attempt: 0, done: false });
    q.pending.sort(function(a, b) { return (b.request.priority || 0) - (a.request.priority || 0) || a.id - b.id; });
    q.pump();
    return true;
  };
  q.pump = function() {
    if (q.stopped) return;
    if (q.active && now() >= q.active.deadline) {
      var expired = q.active;
      var abort = expired.abort;
      finish(expired, { error: "Request timed out", retryable: true });
      if (abort) abort();
    }
    if (q.active || now() < q.nextAt || !q.pending.length) return;
    var task = q.pending.shift();
    q.active = task;
    task.deadline = now() + (task.request.timeout || 8000);
    var attemptId = ++q.sequence;
    task.attemptId = attemptId;
    try { task.abort = start(task.request, function(result) { if (task.attemptId === attemptId) finish(task, result); }); }
    catch (e) { finish(task, { error: String(e) }); }
  };
  q.cancel = function(predicate) {
    var removed = q.pending.filter(function(t) { return predicate(t.request); });
    q.pending = q.pending.filter(function(t) { return !predicate(t.request); });
    if (q.active && predicate(q.active.request)) {
      var task = q.active;
      q.active = null;
      q.nextAt = Math.max(q.nextAt, now() + spacing);
      task.done = true;
      if (task.abort) task.abort();
      removed.push(task);
    }
    removed.forEach(function(t) { t.callback({ error: "Cancelled", cancelled: true }, t.request); });
  };
  q.stop = function() { q.stopped = true; q.cancel(function() { return true; }); };
  return q;
}
