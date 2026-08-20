// MarketModel.js - Core data normalization, instrument definitions, and formatting for Omarchy Market

.pragma library

var ASSET_DEFINITIONS = {
  "BTC": { name: "Bitcoin", symbol: "BTC", baseCurrency: "USD", precision: 2, icon: "₿" },
  "ETH": { name: "Ethereum", symbol: "ETH", baseCurrency: "USD", precision: 2, icon: "Ξ" },
  "SOL": { name: "Solana", symbol: "SOL", baseCurrency: "USD", precision: 2, icon: "◎" },
  "HYPE": { name: "Hyperliquid", symbol: "HYPE", baseCurrency: "USD", precision: 3, icon: "⚡" }
};

var INSTRUMENT_TYPES = {
  SPOT_LAST: "SPOT_LAST",
  SPOT_BID: "SPOT_BID",
  SPOT_ASK: "SPOT_ASK",
  PERP_MID: "PERP_MID",
  PERP_MARK: "PERP_MARK"
};

var DEFAULT_ASSETS = ["BTC", "ETH", "SOL", "HYPE"];

var FRESHNESS_THRESHOLDS = {
  LIVE_MS: 15000,    // < 15s is LIVE
  STALE_MS: 60000    // 15s - 60s is STALE, > 60s is OFFLINE
};

function createEmptyQuote(asset, provider) {
  var def = ASSET_DEFINITIONS[asset] || { name: asset, symbol: asset, precision: 2, icon: "" };
  var prov = provider || "aggregate";
  var inst = (asset === "HYPE" || prov === "hyperliquid") ? (asset + "_USD_PERP") : (asset + "_USD_SPOT");
  var pType = (asset === "HYPE" || prov === "hyperliquid") ? INSTRUMENT_TYPES.PERP_MID : INSTRUMENT_TYPES.SPOT_LAST;

  return {
    asset: asset,
    instrument: inst,
    priceType: pType,
    name: def.name,
    icon: def.icon,
    symbol: asset + "/USD",
    provider: prov,
    exchange: providerDisplayName(prov),
    price: 0,
    change24h: 0,
    high24h: 0,
    low24h: 0,
    volume24h: 0,
    bid: 0,
    ask: 0,
    spread: 0,
    providerTimestamp: 0,
    receivedTimestamp: 0,
    freshness: "OFFLINE"
  };
}

function providerDisplayName(id) {
  if (id === "binance") return "Binance";
  if (id === "coinbase") return "Coinbase";
  if (id === "hyperliquid") return "Hyperliquid";
  if (id === "aggregate") return "Reference Spot";
  return id || "Unknown";
}

function getFreshness(receivedTimestamp, now) {
  var current = now || Date.now();
  if (!receivedTimestamp || receivedTimestamp <= 0) return "OFFLINE";
  var diff = current - receivedTimestamp;
  if (diff < FRESHNESS_THRESHOLDS.LIVE_MS) return "LIVE";
  if (diff < FRESHNESS_THRESHOLDS.STALE_MS) return "STALE";
  return "OFFLINE";
}

// Normalizes Binance 24hr ticker websocket or REST payload
function normalizeBinanceTicker(data, now) {
  if (!data) return null;
  var symbol = String(data.s || "");
  var asset = "";
  if (symbol.indexOf("BTC") === 0) asset = "BTC";
  else if (symbol.indexOf("ETH") === 0) asset = "ETH";
  else if (symbol.indexOf("SOL") === 0) asset = "SOL";
  else if (symbol.indexOf("HYPE") === 0) asset = "HYPE";
  else return null;

  var price = parseFloat(data.c || 0);
  var change24h = parseFloat(data.P || 0);
  var high24h = parseFloat(data.h || 0);
  var low24h = parseFloat(data.l || 0);
  var volume24h = parseFloat(data.q || 0);
  var bid = parseFloat(data.b || 0);
  var ask = parseFloat(data.a || 0);
  var eventTime = parseInt(data.E || Date.now(), 10);
  var recTime = now || Date.now();

  return {
    asset: asset,
    instrument: asset + "_USD_SPOT",
    priceType: INSTRUMENT_TYPES.SPOT_LAST,
    name: (ASSET_DEFINITIONS[asset] && ASSET_DEFINITIONS[asset].name) || asset,
    icon: (ASSET_DEFINITIONS[asset] && ASSET_DEFINITIONS[asset].icon) || "",
    symbol: asset + "/USD",
    provider: "binance",
    exchange: "Binance",
    price: isNaN(price) ? 0 : price,
    change24h: isNaN(change24h) ? 0 : change24h,
    high24h: isNaN(high24h) ? 0 : high24h,
    low24h: isNaN(low24h) ? 0 : low24h,
    volume24h: isNaN(volume24h) ? 0 : volume24h,
    bid: isNaN(bid) ? 0 : bid,
    ask: isNaN(ask) ? 0 : ask,
    spread: (bid > 0 && ask >= bid) ? (ask - bid) : 0,
    providerTimestamp: eventTime,
    receivedTimestamp: recTime,
    freshness: "LIVE"
  };
}

// Normalizes Coinbase Advanced Trade / Exchange ticker payload
function normalizeCoinbaseTicker(data, now) {
  if (!data || (data.type && data.type !== "ticker")) return null;
  var prod = String(data.product_id || "");
  var asset = "";
  if (prod.indexOf("BTC") === 0) asset = "BTC";
  else if (prod.indexOf("ETH") === 0) asset = "ETH";
  else if (prod.indexOf("SOL") === 0) asset = "SOL";
  else if (prod.indexOf("HYPE") === 0) asset = "HYPE";
  else return null;

  var price = parseFloat(data.price || 0);
  var open24h = parseFloat(data.open_24h || 0);
  var change24h = 0;
  if (open24h > 0 && price > 0) {
    change24h = ((price - open24h) / open24h) * 100;
  }
  var high24h = parseFloat(data.high_24h || 0);
  var low24h = parseFloat(data.low_24h || 0);
  var baseVol = parseFloat(data.volume_24h || 0);
  var volume24h = baseVol * (price > 0 ? price : 1);
  var bid = parseFloat(data.best_bid || 0);
  var ask = parseFloat(data.best_ask || 0);
  var eventTime = data.time ? Date.parse(data.time) : Date.now();
  var recTime = now || Date.now();

  return {
    asset: asset,
    instrument: asset + "_USD_SPOT",
    priceType: INSTRUMENT_TYPES.SPOT_LAST,
    name: (ASSET_DEFINITIONS[asset] && ASSET_DEFINITIONS[asset].name) || asset,
    icon: (ASSET_DEFINITIONS[asset] && ASSET_DEFINITIONS[asset].icon) || "",
    symbol: asset + "/USD",
    provider: "coinbase",
    exchange: "Coinbase",
    price: isNaN(price) ? 0 : price,
    change24h: isNaN(change24h) ? 0 : change24h,
    high24h: isNaN(high24h) ? 0 : high24h,
    low24h: isNaN(low24h) ? 0 : low24h,
    volume24h: isNaN(volume24h) ? 0 : volume24h,
    bid: isNaN(bid) ? 0 : bid,
    ask: isNaN(ask) ? 0 : ask,
    spread: (bid > 0 && ask >= bid) ? (ask - bid) : 0,
    providerTimestamp: isNaN(eventTime) ? recTime : eventTime,
    receivedTimestamp: recTime,
    freshness: "LIVE"
  };
}

// Normalizes Hyperliquid metaAndAssetCtxs payload
function normalizeHyperliquidMeta(data, targetAssets, now) {
  if (!data || !Array.isArray(data) || data.length < 2) return [];
  var universe = data[0].universe;
  var ctxs = data[1];
  if (!Array.isArray(universe) || !Array.isArray(ctxs)) return [];

  var targets = targetAssets || DEFAULT_ASSETS;
  var results = [];
  var recTime = now || Date.now();

  for (var i = 0; i < universe.length; i++) {
    var meta = universe[i];
    if (!meta || !meta.name) continue;
    var name = String(meta.name).toUpperCase();
    if (targets.indexOf(name) === -1) continue;

    var ctx = ctxs[i];
    if (!ctx) continue;

    var price = parseFloat(ctx.markPx || ctx.midPx || 0);
    var prevDay = parseFloat(ctx.prevDayPx || 0);
    var change24h = 0;
    if (prevDay > 0 && price > 0) {
      change24h = ((price - prevDay) / prevDay) * 100;
    }
    var volume24h = parseFloat(ctx.dayNtlVlm || 0);
    var bid = ctx.impactPxs && ctx.impactPxs[0] ? parseFloat(ctx.impactPxs[0]) : price;
    var ask = ctx.impactPxs && ctx.impactPxs[1] ? parseFloat(ctx.impactPxs[1]) : price;

    results.push({
      asset: name,
      instrument: name + "_USD_PERP",
      priceType: INSTRUMENT_TYPES.PERP_MID,
      name: (ASSET_DEFINITIONS[name] && ASSET_DEFINITIONS[name].name) || name,
      icon: (ASSET_DEFINITIONS[name] && ASSET_DEFINITIONS[name].icon) || "",
      symbol: name + "/USD",
      provider: "hyperliquid",
      exchange: "Hyperliquid",
      price: isNaN(price) ? 0 : price,
      change24h: isNaN(change24h) ? 0 : change24h,
      high24h: 0,
      low24h: 0,
      volume24h: isNaN(volume24h) ? 0 : volume24h,
      bid: isNaN(bid) ? 0 : bid,
      ask: isNaN(ask) ? 0 : ask,
      spread: (bid > 0 && ask >= bid) ? (ask - bid) : 0,
      providerTimestamp: recTime,
      receivedTimestamp: recTime,
      freshness: "LIVE"
    });
  }

  return results;
}

// Explicit Reference Price Calculation
function calculateReferenceQuote(asset, quotesByProvider, now) {
  if (asset === "HYPE") {
    var hlQuote = quotesByProvider["hyperliquid"];
    if (hlQuote && hlQuote.price > 0 && getFreshness(hlQuote.receivedTimestamp, now) !== "OFFLINE") {
      return hlQuote;
    }
    return createEmptyQuote("HYPE", "hyperliquid");
  }

  // Combine compatible spot providers (Binance + Coinbase)
  var spotQuotes = [];
  var spotProviders = ["binance", "coinbase"];
  for (var i = 0; i < spotProviders.length; i++) {
    var q = quotesByProvider[spotProviders[i]];
    if (q && q.price > 0 && getFreshness(q.receivedTimestamp, now) !== "OFFLINE") {
      spotQuotes.push(q);
    }
  }

  if (spotQuotes.length === 0) {
    var hl = quotesByProvider["hyperliquid"];
    if (hl && hl.price > 0 && getFreshness(hl.receivedTimestamp, now) !== "OFFLINE") {
      return hl;
    }
    return createEmptyQuote(asset, "aggregate");
  }

  if (spotQuotes.length === 1) {
    return spotQuotes[0];
  }

  var totalPrice = 0;
  var totalChange = 0;
  var totalVolume = 0;
  var maxHigh = 0;
  var minLow = Infinity;
  var bestBid = 0;
  var bestAsk = Infinity;
  var latestRec = 0;

  for (var k = 0; k < spotQuotes.length; k++) {
    var item = spotQuotes[k];
    totalPrice += item.price;
    totalChange += item.change24h;
    totalVolume += item.volume24h;
    if (item.high24h > maxHigh) maxHigh = item.high24h;
    if (item.low24h > 0 && item.low24h < minLow) minLow = item.low24h;
    if (item.bid > bestBid) bestBid = item.bid;
    if (item.ask > 0 && item.ask < bestAsk) bestAsk = item.ask;
    if (item.receivedTimestamp > latestRec) latestRec = item.receivedTimestamp;
  }

  var avgPrice = totalPrice / spotQuotes.length;
  var avgChange = totalChange / spotQuotes.length;
  var def = ASSET_DEFINITIONS[asset] || { name: asset, icon: "" };

  return {
    asset: asset,
    instrument: asset + "_USD_SPOT",
    priceType: INSTRUMENT_TYPES.SPOT_LAST,
    name: def.name,
    icon: def.icon,
    symbol: asset + "/USD",
    provider: "aggregate",
    exchange: "Reference Spot (" + spotQuotes.length + " feeds)",
    price: avgPrice,
    change24h: avgChange,
    high24h: maxHigh > 0 ? maxHigh : avgPrice,
    low24h: minLow !== Infinity ? minLow : avgPrice,
    volume24h: totalVolume,
    bid: bestBid,
    ask: bestAsk !== Infinity ? bestAsk : avgPrice,
    spread: (bestBid > 0 && bestAsk !== Infinity && bestAsk >= bestBid) ? (bestAsk - bestBid) : 0,
    providerTimestamp: latestRec,
    receivedTimestamp: latestRec,
    freshness: getFreshness(latestRec, now)
  };
}

// Strict and deterministic price formatting (prevents floating point precision overflow like $2319.1899999999996)
function formatPrice(value, precision) {
  var num = Number(value);
  if (isNaN(num) || num === 0) return "$0.00";
  var p = precision !== undefined ? precision : (num >= 1 ? 2 : 4);
  var fixed = num.toFixed(p);
  var parts = fixed.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return "$" + parts.join(".");
}

function formatCompactPrice(value) {
  var num = Number(value);
  if (isNaN(num) || num === 0) return "$0";
  if (num >= 1000000) {
    return "$" + (num / 1000000).toFixed(2) + "M";
  }
  if (num >= 1000) {
    return "$" + (num / 1000).toFixed(num >= 10000 ? 1 : 2) + "K";
  }
  if (num >= 10) {
    return "$" + num.toFixed(1);
  }
  if (num >= 1) {
    return "$" + num.toFixed(2);
  }
  return "$" + num.toFixed(4);
}

function formatPercentage(value) {
  var num = Number(value);
  if (isNaN(num)) return "0.00%";
  var sign = num > 0 ? "+" : "";
  return sign + num.toFixed(2) + "%";
}

function formatVolume(value) {
  var num = Number(value);
  if (isNaN(num) || num <= 0) return "$0";
  if (num >= 1e9) {
    return "$" + (num / 1e9).toFixed(2) + "B";
  }
  if (num >= 1e6) {
    return "$" + (num / 1e6).toFixed(2) + "M";
  }
  if (num >= 1e3) {
    return "$" + (num / 1e3).toFixed(1) + "K";
  }
  return "$" + num.toFixed(0);
}
