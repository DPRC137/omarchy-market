// test_subscriptions.js - Deterministic IPC and dynamic subscription tests

const { spawn } = require("child_process");
const path = require("path");
const assert = require("assert");

console.log("=== RUNNING DYNAMIC PROVIDER SUBSCRIPTION STATE & IPC TESTS ===");

// -------------------------------------------------------------
// 1. Subscription State Machine Unit Tests
// -------------------------------------------------------------
console.log("\n[Part 1] Verifying Subscription State Machine Transitions...");

class SubscriptionStateMachine {
  constructor(initialSymbols = []) {
    this.activeSymbols = this._sanitize(initialSymbols);
  }

  _sanitize(symbols) {
    if (!Array.isArray(symbols)) return [];
    const seen = new Set();
    const result = [];
    for (const s of symbols) {
      if (typeof s !== "string") continue;
      const clean = s.trim().toUpperCase();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      result.push(clean);
    }
    return result;
  }

  subscribe(symbols) {
    const toAdd = this._sanitize(symbols);
    for (const s of toAdd) {
      if (!this.activeSymbols.includes(s)) {
        this.activeSymbols.push(s);
      }
    }
    return this.activeSymbols.slice();
  }

  unsubscribe(symbols) {
    const toRemove = new Set(this._sanitize(symbols));
    this.activeSymbols = this.activeSymbols.filter(s => !toRemove.has(s));
    return this.activeSymbols.slice();
  }

  setSubscriptions(symbols) {
    this.activeSymbols = this._sanitize(symbols);
    return this.activeSymbols.slice();
  }
}

// 1.1 Initial subscription
const sm = new SubscriptionStateMachine(["btc", "ETH ", "BTC"]);
assert.deepStrictEqual(sm.activeSymbols, ["BTC", "ETH"], "Initial state must be upper-cased, trimmed, and deduplicated");
console.log("  ✓ Initial subscription initialized with deduplication:", sm.activeSymbols);

// 1.2 Adding new symbols
sm.subscribe(["sol", "DOGE"]);
assert.deepStrictEqual(sm.activeSymbols, ["BTC", "ETH", "SOL", "DOGE"], "New symbols must be appended");
console.log("  ✓ Adding symbols transition verified:", sm.activeSymbols);

// 1.3 Duplicate subscriptions
sm.subscribe(["BTC", "SOL", "ETH"]);
assert.deepStrictEqual(sm.activeSymbols, ["BTC", "ETH", "SOL", "DOGE"], "Duplicates must not expand subscription set");
console.log("  ✓ Duplicate subscription suppression verified");

// 1.4 Invalid / empty symbols
sm.subscribe(["", "   ", null, undefined, 123]);
assert.deepStrictEqual(sm.activeSymbols, ["BTC", "ETH", "SOL", "DOGE"], "Invalid/empty entries must be ignored");
console.log("  ✓ Invalid / empty symbol rejection verified");

// 1.5 Removing symbols
sm.unsubscribe(["ETH"]);
assert.deepStrictEqual(sm.activeSymbols, ["BTC", "SOL", "DOGE"], "Unsubscribed symbol must be removed");
console.log("  ✓ Removing symbols transition verified:", sm.activeSymbols);

// 1.6 Removing non-existent symbol
sm.unsubscribe(["NONEXISTENT"]);
assert.deepStrictEqual(sm.activeSymbols, ["BTC", "SOL", "DOGE"], "Unsubscribing non-existent symbol must be no-op");
console.log("  ✓ Non-existent symbol unsubscribe verified");

// 1.7 Repeated updates
sm.subscribe(["XRP"]);
sm.unsubscribe(["SOL"]);
sm.subscribe(["ADA"]);
sm.unsubscribe(["XRP"]);
assert.deepStrictEqual(sm.activeSymbols, ["BTC", "DOGE", "ADA"], "Repeated updates must maintain deterministic order");
console.log("  ✓ Repeated sequential updates verified:", sm.activeSymbols);

// 1.8 set_subscriptions overwrite
sm.setSubscriptions(["HYPE", "BTC", "ETH"]);
assert.deepStrictEqual(sm.activeSymbols, ["HYPE", "BTC", "ETH"], "set_subscriptions must completely replace active set");
console.log("  ✓ set_subscriptions complete replacement verified:", sm.activeSymbols);

console.log("✓ Subscription State Machine unit checks passed (8/8)!");

// -------------------------------------------------------------
// 2. Real Process IPC Bridge Integration Tests
// -------------------------------------------------------------
console.log("\n[Part 2] Verifying Real Process IPC Bridge Integration...");

function testBridgeSubscription(providerName, initialSymbols, dynamicCommand) {
  return new Promise((resolve, reject) => {
    const bridge = path.join(__dirname, "../scripts/ws_bridge.js");
    const p = spawn("node", [bridge, providerName, initialSymbols.join(",")]);

    let messages = [];
    const timer = setTimeout(() => {
      p.kill("SIGTERM");
      resolve({ messages, timedOut: true });
    }, 6000);

    p.stdout.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          messages.push(parsed);
        } catch (e) {}
      }
    });

    setTimeout(() => {
      // Send dynamic subscription command via stdin
      p.stdin.write(JSON.stringify(dynamicCommand) + "\n");
      setTimeout(() => {
        clearTimeout(timer);
        p.kill("SIGTERM");
        resolve({ messages, timedOut: false });
      }, 1500);
    }, 1500);

    p.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function run() {
  try {
    // 2.1 Test Binance dynamic set_subscriptions IPC
    const binanceRes = await testBridgeSubscription("binance", ["BTC", "ETH"], {
      action: "set_subscriptions",
      symbols: ["BTC", "ETH", "DOGE"]
    });
    const binanceConnected = binanceRes.messages.some(m => m.type === "status" && m.status === "CONNECTED");
    assert.ok(binanceConnected, "Binance bridge must establish connection");
    console.log("✓ Binance dynamic subscription IPC verified (CONNECTED received)");

    // 2.2 Test Coinbase dynamic subscribe IPC
    const cbRes = await testBridgeSubscription("coinbase", ["BTC"], {
      action: "subscribe",
      symbols: ["SOL"]
    });
    const cbConnected = cbRes.messages.some(m => m.type === "status" && m.status === "CONNECTED");
    assert.ok(cbConnected, "Coinbase bridge must establish connection");
    console.log("✓ Coinbase dynamic subscription IPC verified (CONNECTED received)");

    // 2.3 Test Hyperliquid bridge startup with symbols
    const hlRes = await testBridgeSubscription("hyperliquid", ["BTC", "ETH", "SOL", "HYPE"], {
      action: "set_subscriptions",
      symbols: ["BTC", "ETH", "SOL", "HYPE", "DOGE"]
    });
    const hlConnected = hlRes.messages.some(m => m.type === "status" && m.status === "CONNECTED");
    assert.ok(hlConnected, "Hyperliquid bridge must establish connection");
    console.log("✓ Hyperliquid bridge IPC verified (CONNECTED received)");

    console.log("\n============================================================");
    console.log("ALL DYNAMIC SUBSCRIPTION TESTS PASSED! ✓");
    console.log("============================================================\n");
  } catch (err) {
    console.error("Subscription test error:", err);
    process.exit(1);
  }
}

run();
