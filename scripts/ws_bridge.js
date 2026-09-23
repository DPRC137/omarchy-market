#!/usr/bin/env node
/**
 * ws_bridge.js - Hardened stdio WebSocket line bridge for Omarchy Market
 * Uses native WHATWG WebSocket (Node.js standard library, zero dependencies)
 */

"use strict";

const readline = require("readline");

const VALID_PROVIDERS = ["binance", "coinbase", "hyperliquid"];
const rawProvider = (process.argv[2] || "binance").toLowerCase().trim();

if (!VALID_PROVIDERS.includes(rawProvider)) {
  console.error(`Invalid provider: ${rawProvider}. Must be one of: ${VALID_PROVIDERS.join(", ")}`);
  process.exit(1);
}

const provider = rawProvider;
const rawSymbolsArg = process.argv[3] || "";
let activeSymbols = parseSymbols(rawSymbolsArg);

function sanitizeSymbols(symbols) {
  const arr = Array.isArray(symbols)
    ? symbols
    : (typeof symbols === "string" ? symbols.split(",") : []);
  const seen = new Set();
  const result = [];
  for (const s of arr) {
    if (typeof s !== "string") continue;
    const clean = s.trim().toUpperCase();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

function parseSymbols(str) {
  if (!str) {
    return provider === "hyperliquid" ? ["BTC", "ETH", "SOL", "HYPE"] : ["BTC", "ETH", "SOL"];
  }
  const list = sanitizeSymbols(str);
  return list.length > 0 ? list : (provider === "hyperliquid" ? ["BTC", "ETH", "SOL", "HYPE"] : ["BTC", "ETH", "SOL"]);
}

let ws = null;
let reconnectTimer = null;
let pingTimer = null;
let watchdogTimer = null;
let reconnectDelay = 1000;
let isClosing = false;
let lastMessageTime = Date.now();

function emit(data) {
  if (isClosing) return;
  try {
    process.stdout.write(JSON.stringify(data) + "\n");
  } catch (e) {
    cleanupAndExit(0);
  }
}

function resetWatchdog() {
  lastMessageTime = Date.now();
  if (watchdogTimer) clearTimeout(watchdogTimer);
  // If no message or heartbeat frame is received in 45 seconds, trigger reconnection
  watchdogTimer = setTimeout(() => {
    if (!isClosing && ws) {
      emit({ type: "status", provider, status: "STALE", reason: "Watchdog timeout: no traffic for 45s" });
      try { ws.close(); } catch (e) {}
    }
  }, 45000);
}

function clearAllTimers() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function connect() {
  if (isClosing) return;
  clearAllTimers();

  emit({ type: "status", provider, status: "CONNECTING" });
  emit({ type: "subscriptions", provider, action: "initial", symbols: activeSymbols.slice() });

  try {
    if (provider === "binance") {
      connectBinance();
    } else if (provider === "coinbase") {
      connectCoinbase();
    } else if (provider === "hyperliquid") {
      connectHyperliquid();
    }
  } catch (err) {
    handleClose(err ? err.message : "Connect exception");
  }
}

function getBinanceStreams(symbols) {
  return symbols
    .filter(s => s !== "HYPE") // HYPE is hyperliquid only
    .map(s => s.toLowerCase() + "usdt@ticker");
}

function connectBinance() {
  const streams = getBinanceStreams(activeSymbols);
  const streamPath = streams.length > 0 ? streams.join("/") : "btcusdt@ticker";
  const url = `wss://stream.binance.com:9443/stream?streams=${streamPath}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectDelay = 1000;
    resetWatchdog();
    emit({ type: "status", provider: "binance", status: "CONNECTED" });
  };

  ws.onmessage = (event) => {
    resetWatchdog();
    try {
      const payload = JSON.parse(event.data);
      if (payload && payload.data) {
        emit({ type: "ticker", provider: "binance", raw: payload.data });
      }
    } catch (e) {}
  };

  ws.onclose = () => handleClose("Binance stream closed");
  ws.onerror = (err) => handleClose("Binance stream error");
}

function getCoinbaseProducts(symbols) {
  return symbols
    .filter(s => s !== "HYPE")
    .map(s => s + "-USD");
}

function connectCoinbase() {
  const url = "wss://ws-feed.exchange.coinbase.com";
  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectDelay = 1000;
    resetWatchdog();
    emit({ type: "status", provider: "coinbase", status: "CONNECTED" });
    const products = getCoinbaseProducts(activeSymbols);
    if (products.length > 0) {
      const subMsg = JSON.stringify({
        type: "subscribe",
        product_ids: products,
        channels: ["ticker"]
      });
      try { ws.send(subMsg); } catch (e) {}
    }
  };

  ws.onmessage = (event) => {
    resetWatchdog();
    try {
      const payload = JSON.parse(event.data);
      if (payload && payload.type === "ticker") {
        emit({ type: "ticker", provider: "coinbase", raw: payload });
      }
    } catch (e) {}
  };

  ws.onclose = () => handleClose("Coinbase stream closed");
  ws.onerror = (err) => handleClose("Coinbase stream error");
}

function connectHyperliquid() {
  const url = "wss://api.hyperliquid.xyz/ws";
  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectDelay = 1000;
    resetWatchdog();
    emit({ type: "status", provider: "hyperliquid", status: "CONNECTED" });
    try {
      ws.send(JSON.stringify({
        method: "subscribe",
        subscription: { type: "allMids" }
      }));
    } catch (e) {}

    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ method: "ping" })); } catch (e) {}
      }
    }, 20000);
  };

  ws.onmessage = (event) => {
    resetWatchdog();
    try {
      const payload = JSON.parse(event.data);
      if (payload && payload.channel === "allMids" && payload.data && payload.data.mids) {
        emit({ type: "mids", provider: "hyperliquid", mids: payload.data.mids });
      }
    } catch (e) {}
  };

  ws.onclose = () => handleClose("Hyperliquid stream closed");
  ws.onerror = (err) => handleClose("Hyperliquid stream error");
}

// Dynamic Subscription Management over stdin
function handleStdinCommand(cmdObj) {
  if (!cmdObj || typeof cmdObj !== "object") return;
  const action = cmdObj.action || cmdObj.cmd;
  const symbols = sanitizeSymbols(cmdObj.symbols);

  if (action === "set_subscriptions") {
    const oldSymbols = activeSymbols;
    activeSymbols = symbols;
    emit({ type: "subscriptions", provider, action: "set_subscriptions", symbols: activeSymbols.slice() });

    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (provider === "binance") {
      const toUnsub = oldSymbols.filter(s => !symbols.includes(s));
      const toSub = symbols.filter(s => !oldSymbols.includes(s));

      const unsubStreams = getBinanceStreams(toUnsub);
      if (unsubStreams.length > 0) {
        try {
          ws.send(JSON.stringify({
            method: "UNSUBSCRIBE",
            params: unsubStreams,
            id: Date.now()
          }));
        } catch (e) {}
      }

      const subStreams = getBinanceStreams(toSub);
      if (subStreams.length > 0) {
        try {
          ws.send(JSON.stringify({
            method: "SUBSCRIBE",
            params: subStreams,
            id: Date.now() + 1
          }));
        } catch (e) {}
      }
    } else if (provider === "coinbase") {
      const toUnsub = oldSymbols.filter(s => !symbols.includes(s));
      const toSub = symbols.filter(s => !oldSymbols.includes(s));

      const unsubProducts = getCoinbaseProducts(toUnsub);
      if (unsubProducts.length > 0) {
        try {
          ws.send(JSON.stringify({
            type: "unsubscribe",
            product_ids: unsubProducts,
            channels: ["ticker"]
          }));
        } catch (e) {}
      }

      const subProducts = getCoinbaseProducts(toSub);
      if (subProducts.length > 0) {
        try {
          ws.send(JSON.stringify({
            type: "subscribe",
            product_ids: subProducts,
            channels: ["ticker"]
          }));
        } catch (e) {}
      }
    }
  } else if (action === "subscribe") {
    const newSyms = symbols.filter(s => !activeSymbols.includes(s));
    if (newSyms.length > 0) {
      activeSymbols = activeSymbols.concat(newSyms);
    }
    emit({ type: "subscriptions", provider, action: "subscribe", symbols: activeSymbols.slice() });

    if (newSyms.length === 0 || !ws || ws.readyState !== WebSocket.OPEN) return;

    if (provider === "binance") {
      const streams = getBinanceStreams(newSyms);
      if (streams.length > 0) {
        try {
          ws.send(JSON.stringify({
            method: "SUBSCRIBE",
            params: streams,
            id: Date.now()
          }));
        } catch (e) {}
      }
    } else if (provider === "coinbase") {
      const products = getCoinbaseProducts(newSyms);
      if (products.length > 0) {
        try {
          ws.send(JSON.stringify({
            type: "subscribe",
            product_ids: products,
            channels: ["ticker"]
          }));
        } catch (e) {}
      }
    }
  } else if (action === "unsubscribe") {
    activeSymbols = activeSymbols.filter(s => !symbols.includes(s));
    emit({ type: "subscriptions", provider, action: "unsubscribe", symbols: activeSymbols.slice() });

    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (provider === "binance") {
      const streams = getBinanceStreams(symbols);
      if (streams.length > 0) {
        try {
          ws.send(JSON.stringify({
            method: "UNSUBSCRIBE",
            params: streams,
            id: Date.now()
          }));
        } catch (e) {}
      }
    } else if (provider === "coinbase") {
      const products = getCoinbaseProducts(symbols);
      if (products.length > 0) {
        try {
          ws.send(JSON.stringify({
            type: "unsubscribe",
            product_ids: products,
            channels: ["ticker"]
          }));
        } catch (e) {}
      }
    }
  }
}

// Setup stdin line reader for dynamic IPC from QML
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", (line) => {
  if (!line || !line.trim()) return;
  try {
    const msg = JSON.parse(line.trim());
    handleStdinCommand(msg);
  } catch (e) {}
});

function handleClose(reason) {
  if (isClosing) return;
  clearAllTimers();
  emit({ type: "status", provider, status: "RECONNECTING", reason: String(reason || "") });

  const jitter = Math.floor(Math.random() * 1000);
  const delay = Math.min(30000, reconnectDelay) + jitter;
  reconnectDelay = Math.min(30000, reconnectDelay * 2);

  reconnectTimer = setTimeout(() => {
    connect();
  }, delay);
}

function cleanupAndExit(code = 0) {
  if (isClosing) return;
  isClosing = true;
  clearAllTimers();
  if (ws) {
    try {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
    } catch (e) {}
    ws = null;
  }
  process.exit(code);
}

// Ensure process terminates cleanly when parent shell exits or closes pipes
process.on("SIGINT", () => cleanupAndExit(0));
process.on("SIGTERM", () => cleanupAndExit(0));
process.on("SIGHUP", () => cleanupAndExit(0));
process.stdin.on("end", () => cleanupAndExit(0));
process.stdin.on("close", () => cleanupAndExit(0));
process.on("exit", () => cleanupAndExit(0));

connect();

