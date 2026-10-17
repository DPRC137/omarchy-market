.pragma library

var RANGES = ["1D", "1W", "1M", "1Y"];
function specification(asset, provider, range, now) {
  var days = { "1D": 1, "1W": 7, "1M": 30, "1Y": 365 }[range];
  if (!days || !asset || !/^[A-Z0-9.\-]{1,24}$/.test(asset)) return null;
  var interval = { "1D": "5m", "1W": "1h", "1M": "4h", "1Y": "1d" }[range];
  if (provider === "yahoo") interval = { "1D": "5m", "1W": "30m", "1M": "1h", "1Y": "1d" }[range];
  var from = now - days * 86400000;
  var req = { asset: asset, provider: provider, range: range, interval: interval, from: from, to: now, priority: 100, kind: "history" };
  req.key = [provider, asset, range, interval].join(":");
  if (provider === "binance") {
    req.instrument = asset + "USDT";
    req.url = "https://api.binance.com/api/v3/klines?symbol=" + req.instrument + "&interval=" + interval + "&startTime=" + from + "&endTime=" + now + "&limit=1000";
  } else if (provider === "hyperliquid") {
    req.instrument = asset;
    req.url = "https://api.hyperliquid.xyz/info";
    req.body = JSON.stringify({ type: "candleSnapshot", req: { coin: asset, interval: interval, startTime: from, endTime: now } });
  } else if (provider === "yahoo") {
    req.instrument = asset;
    req.url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(asset) + "?interval=" + interval + "&period1=" + Math.floor(from / 1000) + "&period2=" + Math.floor(now / 1000) + "&includePrePost=false";
  } else return null;
  return req;
}

function normalize(data, request) {
  var rows = [];
  if (request.provider === "yahoo") {
    var result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result || !result.meta || result.meta.symbol !== request.asset || !/^[A-Za-z]{3}$/.test(result.meta.currency || "")) throw new Error("Unexpected instrument or currency");
    var closes = result.indicators && result.indicators.quote && result.indicators.quote[0];
    if (!closes) throw new Error("No price history");
    rows = (result.timestamp || []).map(function(t, i) { return { time: t * 1000, close: closes.close[i] }; });
    if (request.currency && request.currency !== result.meta.currency) throw new Error("Quote and history currency differ; refresh quote");
    request.currency = result.meta.currency;
  } else {
    if (!Array.isArray(data)) throw new Error("Invalid history payload");
    rows = data.map(function(c) {
      if (request.provider === "hyperliquid" && (c.s !== request.instrument || c.i !== request.interval)) throw new Error("Unexpected instrument or interval");
      return request.provider === "binance" ? { time: Number(c[0]), close: Number(c[4]) } : { time: Number(c.t), close: Number(c.c) };
    });
  }
  var seen = {};
  return rows.filter(function(c) {
    if (c.close === null || !(c.close > 0) || !Number.isFinite(c.close) || !Number.isFinite(c.time) || c.time < request.from || c.time > request.to || seen[c.time]) return false;
    seen[c.time] = true; return true;
  }).sort(function(a, b) { return a.time - b.time; }).slice(-1000);
}

function create(transport, changed, now) {
  var h = { cache: {}, generation: 0, visible: null, state: "unavailable", error: "Select an instrument", ttl: 60000, maxEntries: 32 };
  h.entry = function() { return h.visible ? h.cache[h.visible.key] : null; };
  h.select = function(asset, provider, range, currency, force) {
    var request = specification(asset, provider, range, now());
    if (!request) return;
    var same = h.visible && h.visible.key === request.key;
    if (same && h.state === "loading" && !force) return;
    // Changing view cancels queued AND in-flight old work. Invalidation happens
    // before abort, since Qt emits readyState synchronously from abort().
    h.generation++;
    var generation = h.generation;
    h.visible = request;
    request.generation = generation;
    request.currency = currency;
    transport.cancel(function() { return true; });
    var entry = h.entry();
    if (entry && currency && entry.currency !== currency) { delete h.cache[request.key]; entry = null; }
    if (!force && entry && now() - entry.savedAt < h.ttl) { h.state = "ready"; h.error = ""; changed(); return; }
    h.state = "loading"; h.error = ""; changed();
    transport.enqueue(request, function(result, identity) {
      if (!h.visible || generation !== h.generation || identity.generation !== generation || identity.key !== h.visible.key || identity.provider !== provider || identity.asset !== asset || identity.interval !== request.interval || identity.instrument !== request.instrument) return;
      if (result.cancelled) { h.state = entry ? "stale" : "unavailable"; h.error = "Cancelled"; changed(); return; }
      try {
        if (result.error) throw new Error(result.error);
        var points = normalize(result.data, request);
        if (points.length < 2) throw new Error("No history in this range (market may be closed)");
        h.cache[request.key] = { points: points, savedAt: now(), provider: provider, currency: request.currency, interval: request.interval };
        var keys = Object.keys(h.cache).sort(function(a, b) { return h.cache[a].savedAt - h.cache[b].savedAt; });
        while (keys.length > h.maxEntries) delete h.cache[keys.shift()];
        h.state = "ready"; h.error = "";
      } catch (e) { h.state = h.entry() ? "stale" : "unavailable"; h.error = String(e.message || e); }
      changed();
    });
  };
  h.clear = function() { h.generation++; h.visible = null; transport.cancel(function() { return true; }); h.state = "unavailable"; changed(); };
  h.expire = function() { var e = h.entry(); if (e && h.state === "ready" && now() - e.savedAt >= h.ttl) { h.state = "stale"; changed(); } };
  return h;
}
