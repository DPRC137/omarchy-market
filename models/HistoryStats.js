.pragma library

// Statistics describe observed candle closes, never intrabar extremes or the
// current headline quote. Normalize a copy so callers retain their cached data.
function summarize(points) {
  var seen = {};
  var rows = (points || []).filter(function(p) {
    if (!p || !Number.isFinite(p.time) || p.time <= 0 || !Number.isFinite(p.close) || p.close <= 0 || seen[p.time]) return false;
    seen[p.time] = true;
    return true;
  }).slice().sort(function(a, b) { return a.time - b.time; });
  var stats = { count: rows.length, firstTime: null, lastTime: null, first: null, last: null, high: null, low: null, mean: null, change: null, changePercent: null };
  if (!rows.length) return stats;
  stats.firstTime = rows[0].time; stats.lastTime = rows[rows.length - 1].time;
  stats.first = rows[0].close; stats.last = rows[rows.length - 1].close;
  stats.high = stats.low = stats.mean = stats.first;
  for (var i = 1; i < rows.length; i++) {
    stats.high = Math.max(stats.high, rows[i].close);
    stats.low = Math.min(stats.low, rows[i].close);
    stats.mean += (rows[i].close - stats.mean) / (i + 1);
  }
  if (rows.length > 1) {
    stats.change = stats.last - stats.first;
    var percentage = stats.change / stats.first * 100;
    stats.changePercent = Number.isFinite(percentage) ? percentage : null;
  }
  return stats;
}
