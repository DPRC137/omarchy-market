#!/usr/bin/env node
/**
 * ws_bridge.js - Hardened stdio WebSocket line bridge for Omarchy Market
 * Uses native WHATWG WebSocket (Node.js standard library, zero dependencies)
 */

"use strict";

const VALID_PROVIDERS = ["binance", "coinbase", "hyperliquid"];
const rawProvider = (process.argv[2] || "binance").toLowerCase().trim();

if (!VALID_PROVIDERS.includes(rawProvider)) {
  console.error(`Invalid provider: ${rawProvider}. Must be one of: ${VALID_PROVIDERS.join(", ")}`);
  process.exit(1);
}

const provider = rawProvider;
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

function connectBinance() {
  const url = "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/solusdt@ticker";
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

function connectCoinbase() {
  const url = "wss://ws-feed.exchange.coinbase.com";
  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectDelay = 1000;
    resetWatchdog();
    emit({ type: "status", provider: "coinbase", status: "CONNECTED" });
    const subMsg = JSON.stringify({
      type: "subscribe",
      product_ids: ["BTC-USD", "ETH-USD", "SOL-USD"],
      channels: ["ticker"]
    });
    try { ws.send(subMsg); } catch (e) {}
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
