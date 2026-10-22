#!/usr/bin/env node
/**
 * ws_bridge.js - Hardened stdio WebSocket line bridge for Omarchy Market
 * Bundled ws client enforces receive budgets before message assembly.
 */

"use strict";

const readline = require("readline");

// Never resolve optional native addons from ambient node_modules paths.
process.env.WS_NO_BUFFER_UTIL = "1";
process.env.WS_NO_UTF_8_VALIDATE = "1";
const WebSocket = require("../third_party/ws/lib/websocket");
const Protocol = require("./ws_protocol");

function socketFor(url) {
  const socket = new WebSocket(url, {
    maxPayload: provider === "hyperliquid" ? 64 * 1024 : Protocol.MAX_MESSAGE_BYTES,
    maxFragments: 32,
    maxBufferedChunks: 64,
    perMessageDeflate: false,
    followRedirects: false,
    handshakeTimeout: 10000,
    maxHeaderSize: 8192,
    closeTimeout: 1000
  });
  // terminate() during CONNECTING reports an asynchronous error after its
  // application handlers are detached. Keep that cleanup error handled.
  socket.on("error", () => {});
  return socket;
}

const VALID_PROVIDERS = ["binance", "coinbase", "hyperliquid"];
const rawProvider = (process.argv[2] || "binance").toLowerCase().trim();

if (!VALID_PROVIDERS.includes(rawProvider)) {
  console.error(`Invalid provider: ${rawProvider}. Must be one of: ${VALID_PROVIDERS.join(", ")}`);
  process.exit(1);
}

const provider = rawProvider;
const rawSymbolsArg = process.argv[3];
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
    if (!/^[A-Z0-9]{1,12}$/.test(clean) || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
    if (result.length === Protocol.MAX_SYMBOLS) break;
  }
  return result;
}

function parseSymbols(str) {
  if (str === undefined) return provider === "hyperliquid" ? ["BTC", "ETH", "SOL", "HYPE"] : ["BTC", "ETH", "SOL"];
  return sanitizeSymbols(str);
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
    const line = JSON.stringify(data) + "\n";
    const bytes = Buffer.byteLength(line);
    if (bytes > Protocol.MAX_LINE_BYTES) return cleanupAndExit(1);
    if ((process.stdout.writableLength || 0) + bytes > 16384) return cleanupAndExit(0);
    // A slow/stopped shell must not accumulate an unbounded write queue.
    if (!process.stdout.write(line)) cleanupAndExit(0);
  } catch (e) {
    cleanupAndExit(0);
  }
}

function resetWatchdog(timeout = 45000) {
  lastMessageTime = Date.now();
  if (watchdogTimer) clearTimeout(watchdogTimer);
  // Reconnect directly: close() is not guaranteed to deliver an onclose event.
  watchdogTimer = setTimeout(() => {
    if (!isClosing && ws) {
      emit({ type: "status", provider, status: "STALE", reason: "Watchdog timeout: no traffic for " + timeout / 1000 + "s" });
      handleClose("Watchdog timeout");
    }
  }, timeout);
}

function clearAllTimers() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
  if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function connect() {
  if (isClosing) return;
  clearAllTimers();
  if (activeSymbols.length === 0) { emit({ type: "status", provider, status: "DISCONNECTED" }); return; }

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
    // A connection that never opens never receives the normal traffic watchdog.
    resetWatchdog(10000);
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
  const streamPath = streams.join("/");
  const url = `wss://stream.binance.com:9443/stream?streams=${streamPath}`;
  ws = socketFor(url);

  ws.onopen = () => {
    reconnectDelay = 1000;
    resetWatchdog();
    emit({ type: "status", provider: "binance", status: "CONNECTED" });
  };

  ws.onmessage = (event) => {
    resetWatchdog();
    try {
      if (typeof event.data !== "string" || Buffer.byteLength(event.data) > (provider === "hyperliquid" ? 65536 : Protocol.MAX_MESSAGE_BYTES)) {
        handleClose("Invalid or oversized WebSocket message"); return;
      }
      const payload = JSON.parse(event.data);
      if (payload && payload.data) {
        const message = Protocol.ticker("binance", payload.data, activeSymbols);
        if (message) emit(message);
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
  ws = socketFor(url);

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
      if (typeof event.data !== "string" || Buffer.byteLength(event.data) > (provider === "hyperliquid" ? 65536 : Protocol.MAX_MESSAGE_BYTES)) {
        handleClose("Invalid or oversized WebSocket message"); return;
      }
      const payload = JSON.parse(event.data);
      if (payload && payload.type === "ticker") {
        const message = Protocol.ticker("coinbase", payload, activeSymbols);
        if (message) emit(message);
      }
    } catch (e) {}
  };

  ws.onclose = () => handleClose("Coinbase stream closed");
  ws.onerror = (err) => handleClose("Coinbase stream error");
}

function connectHyperliquid() {
  const url = "wss://api.hyperliquid.xyz/ws";
  ws = socketFor(url);

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
      if (typeof event.data !== "string" || Buffer.byteLength(event.data) > (provider === "hyperliquid" ? 65536 : Protocol.MAX_MESSAGE_BYTES)) {
        handleClose("Invalid or oversized WebSocket message"); return;
      }
      const payload = JSON.parse(event.data);
      if (payload && payload.channel === "allMids" && payload.data && payload.data.mids) {
        const mids = {};
        for (const symbol of activeSymbols) {
          const value = Protocol.scalar(payload.data.mids[symbol]);
          if (value !== undefined) mids[symbol] = value;
        }
        emit({ type: "mids", provider: "hyperliquid", mids });
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
  if (action === "reconnect") {
    clearAllTimers();
    closeSocket();
    reconnectDelay = 1000;
    connect();
    return;
  }
  const symbols = sanitizeSymbols(cmdObj.symbols);

  if (action === "set_subscriptions") {
    const oldSymbols = activeSymbols;
    activeSymbols = symbols;
    emit({ type: "subscriptions", provider, action: "set_subscriptions", symbols: activeSymbols.slice() });

    if (activeSymbols.length === 0) { clearAllTimers(); closeSocket(); emit({ type: "status", provider, status: "DISCONNECTED" }); return; }
    if (!ws) { connect(); return; }
    if (ws.readyState !== WebSocket.OPEN) return;

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
      activeSymbols = sanitizeSymbols(activeSymbols.concat(newSyms));
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

function closeSocket() {
  if (!ws) return;
  ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
  try { ws.terminate(); } catch (e) {}
  ws = null;
}

function handleClose(reason) {
  if (isClosing) return;
  clearAllTimers();
  closeSocket();
  emit({ type: "status", provider, status: "RECONNECTING", reason: String(reason || "").replace(/[^\x20-\x7e]/g, "?").slice(0, 160) });

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
      ws.terminate();
    } catch (e) {}
    ws = null;
  }
  process.exit(code);
}

// Ensure process terminates cleanly when parent shell exits or closes pipes
process.stdout.on("error", () => cleanupAndExit(0));
process.on("SIGINT", () => cleanupAndExit(0));
process.on("SIGTERM", () => cleanupAndExit(0));
process.on("SIGHUP", () => cleanupAndExit(0));
process.stdin.on("end", () => cleanupAndExit(0));
process.stdin.on("close", () => cleanupAndExit(0));
process.on("exit", () => cleanupAndExit(0));

connect();
