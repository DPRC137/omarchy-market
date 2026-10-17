.pragma library

var RANGES = ["1D", "1W", "1M", "1Y"];
function specification(asset, provider, range, now) {
  var days = { "1D": 1, "1W": 7, "1M": 30, "1Y": 365 }[range];
  if (!days || !asset || !/^[A-Z0-9.\-]{1,24}$/.test(asset)) return null;
  var interval = { "1D": "5m", "1W": "1h", "1M": "4h", "1Y": "1d" }[range];
  if (provider === "yahoo") interval = { "1D": "5m", "1W": "30m", "1M": "1h", "1Y": "1d" }[range];
  var from = now - days * 86400000;
  var req = { asset: asset, provider: provider, range: range, interval: interval, from: from, to: now, priority: 100, kind: "history", historyAttempt: 0, window: provider === "yahoo" && range === "1D" ? "session" : "calendar" };
  req.key = [provider, asset, range, interval, req.window].join(":");
  if (provider === "binance") {
    req.instrument = asset + "USDT";
    req.url = "https://api.binance.com/api/v3/klines?symbol=" + req.instrument + "&interval=" + interval + "&startTime=" + from + "&endTime=" + now + "&limit=1000";
  } else if (provider === "hyperliquid") {
    req.instrument = asset;
    req.url = "https://api.hyperliquid.xyz/info";
    req.body = JSON.stringify({ type: "candleSnapshot", req: { coin: asset, interval: interval, startTime: from, endTime: now } });
  } else if (provider === "yahoo") {
    req.instrument = asset;
    var endpoint = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(asset) + "?interval=" + interval;
    if (req.window === "session") {
      req.from = null;
      req.httpRange = "1d";
      req.url = endpoint + "&range=1d&includePrePost=false";
    } else req.url = endpoint + "&period1=" + Math.floor(from / 1000) + "&period2=" + Math.floor(now / 1000) + "&includePrePost=false";
  } else return null;
  return req;
}

function validPoint(c, to) {
  return c.close !== null && typeof c.close === "number" && Number.isFinite(c.close) && c.close > 0 && Number.isFinite(c.time) && c.time > 0 && c.time <= to;
}

// Use provider-supplied regular-session boundaries, never local weekdays or
// fixed US hours. Session metadata can describe a future opening with no bars.
function selectSession(rows, result, request) {
  var periods = [];
  function collect(value, depth) {
    if (!value || depth > 4) return;
    if (Array.isArray(value)) { value.forEach(function(v) { collect(v, depth + 1); }); return; }
    if (Number.isFinite(value.start) && Number.isFinite(value.end) && value.end >= value.start && value.start > 0) periods.push(value);
  }
  collect(result.tradingPeriods && (result.tradingPeriods.regular || result.tradingPeriods), 0);
  var hasSessionSchedule = periods.length > 0;
  if (!periods.length) collect(result.meta.currentTradingPeriod && result.meta.currentTradingPeriod.regular, 0);
  periods.sort(function(a, b) { return b.start - a.start; });
  var selected = null;
  for (var i = 0; i < periods.length; i++) {
    var p = periods[i];
    if (rows.some(function(c) { return validPoint(c, request.to) && c.time >= p.start * 1000 && c.time <= p.end * 1000; })) { selected = p; break; }
  }
  request.windowLabel = "Latest regular session";
  var valid = rows.filter(function(c) { return validPoint(c, request.to); });
  if (selected) {
    request.sessionStart = selected.start * 1000;
    request.sessionEnd = selected.end * 1000;
    var offset = Number.isFinite(selected.gmtoffset) ? selected.gmtoffset : result.meta.gmtoffset;
    if (Number.isFinite(offset)) request.sessionDate = new Date((selected.start + offset) * 1000).toISOString().slice(0, 10);
    return valid.filter(function(c) { return c.time >= request.sessionStart && c.time <= request.sessionEnd; });
  }
  if (!valid.length || hasSessionSchedule) return [];
  // Some Yahoo responses omit tradingPeriods, and currentTradingPeriod may
  // already describe the next opening. range=1d is already scoped to
  // one trading session; a wider recovery needs the exchange offset to select
  // its last date rather than presenting five days under a 1D label.
  var gmtoffset = result.meta.gmtoffset;
  if (Number.isFinite(gmtoffset)) {
    var latest = Math.max.apply(null, valid.map(function(c) { return c.time; }));
    request.sessionDate = new Date(latest + gmtoffset * 1000).toISOString().slice(0, 10);
    return valid.filter(function(c) { return new Date(c.time + gmtoffset * 1000).toISOString().slice(0, 10) === request.sessionDate; });
  }
  if (request.httpRange === "1d") return valid;
  throw new Error("Yahoo omitted regular-session boundaries");
}

function normalize(data, request) {
  var rows = [];
  if (request.provider === "yahoo") {
    var result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result || !result.meta || result.meta.symbol !== request.asset || !/^[A-Za-z]{3}$/.test(result.meta.currency || "")) throw new Error("Unexpected instrument or currency");
    var closes = result.indicators && result.indicators.quote && result.indicators.quote[0];
    if (result.meta.dataGranularity && result.meta.dataGranularity !== request.interval) throw new Error("Unexpected candle interval");
    var timestamps = result.timestamp || [];
    if (!Array.isArray(timestamps) || (timestamps.length && (!closes || !Array.isArray(closes.close)))) throw new Error("Invalid price history");
    rows = timestamps.map(function(t, i) { return { time: t * 1000, close: closes.close[i] }; });
    if (request.currency && request.currency !== result.meta.currency) throw new Error("Quote and history currency differ; refresh quote");
    request.currency = result.meta.currency;
    if (request.window === "session") rows = selectSession(rows, result, request);
  } else {
    if (!Array.isArray(data)) throw new Error("Invalid history payload");
    rows = data.map(function(c) {
      if (request.provider === "hyperliquid" && (c.s !== request.instrument || c.i !== request.interval)) throw new Error("Unexpected instrument or interval");
      return request.provider === "binance" ? { time: Number(c[0]), close: Number(c[4]) } : { time: Number(c.t), close: Number(c.c) };
    });
  }
  var seen = {};
  return rows.filter(function(c) {
    if (!validPoint(c, request.to) || (request.from !== null && c.time < request.from) || seen[c.time]) return false;
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
    function submit(sent) {
      transport.enqueue(sent, function(result, identity) {
        if (!h.visible || generation !== h.generation || identity.generation !== generation || identity.key !== h.visible.key || identity.historyAttempt !== h.visible.historyAttempt || identity.provider !== provider || identity.asset !== asset || identity.interval !== sent.interval || identity.instrument !== sent.instrument) return;
        if (result.cancelled) { h.state = entry ? "stale" : "unavailable"; h.error = "Cancelled"; changed(); return; }
        try {
          if (result.error) throw new Error(result.error);
          var points = normalize(result.data, sent);
          if (!points.length && sent.window === "session" && sent.httpRange === "1d") {
            // One bounded recovery on an empty successful response. This is the
            // same equity/interval/source; it never substitutes another market.
            var recovery = Object.assign({}, sent, { httpRange: "5d", historyAttempt: 1, url: sent.url.replace("range=1d", "range=5d") });
            h.visible = recovery;
            submit(recovery);
            return;
          }
          if (!points.length) throw new Error("Provider returned no candles for this instrument and range");
          h.cache[sent.key] = { points: points, savedAt: now(), provider: provider, currency: sent.currency, interval: sent.interval, windowLabel: sent.windowLabel || "", sessionDate: sent.sessionDate || "" };
          var keys = Object.keys(h.cache).sort(function(a, b) { return h.cache[a].savedAt - h.cache[b].savedAt; });
          while (keys.length > h.maxEntries) delete h.cache[keys.shift()];
          h.state = "ready"; h.error = "";
        } catch (e) { h.state = h.entry() ? "stale" : "unavailable"; h.error = String(e.message || e); }
        changed();
      });
    }
    submit(request);
  };
  h.clear = function() { h.generation++; h.visible = null; transport.cancel(function() { return true; }); h.state = "unavailable"; changed(); };
  h.expire = function() { var e = h.entry(); if (e && h.state === "ready" && now() - e.savedAt >= h.ttl) { h.state = "stale"; changed(); } };
  return h;
}
