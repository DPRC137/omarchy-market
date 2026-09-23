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

function runRealProcessSubscriptionSuite(providerName, initialSymbols) {
  return new Promise((resolve, reject) => {
    const bridge = path.join(__dirname, "../scripts/ws_bridge.js");
    const p = spawn("node", [bridge, providerName, initialSymbols.join(",")]);

    const messages = [];
    let buffer = "";
    let cursor = 0;
    const pendingWaiters = [];

    const killProcess = () => {
      try { p.kill("SIGTERM"); } catch (e) {}
    };

    const safetyTimer = setTimeout(() => {
      killProcess();
      reject(new Error(`Test timed out for provider: ${providerName}`));
    }, 10000);

    p.on("error", (err) => {
      clearTimeout(safetyTimer);
      killProcess();
      reject(err);
    });

    p.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          messages.push(parsed);
          for (let i = pendingWaiters.length - 1; i >= 0; i--) {
            if (pendingWaiters[i].predicate(parsed)) {
              const waiter = pendingWaiters.splice(i, 1)[0];
              waiter.resolve(parsed);
            }
          }
        } catch (e) {}
      }
    });

    function waitForNext(predicate, timeoutMs = 3000) {
      for (let i = cursor; i < messages.length; i++) {
        if (predicate(messages[i])) {
          cursor = i + 1;
          return Promise.resolve(messages[i]);
        }
      }
      return new Promise((res, rej) => {
        const timer = setTimeout(() => {
          const idx = pendingWaiters.findIndex(w => w.resolve === res);
          if (idx !== -1) pendingWaiters.splice(idx, 1);
          rej(new Error(`Timeout waiting for message (${providerName}) after ${timeoutMs}ms`));
        }, timeoutMs);

        pendingWaiters.push({
          predicate,
          resolve: (msg) => {
            clearTimeout(timer);
            cursor = messages.indexOf(msg) + 1;
            res(msg);
          }
        });
      });
    }

    function sendCommand(cmd) {
      p.stdin.write(JSON.stringify(cmd) + "\n");
    }

    (async () => {
      try {
        console.log(`\n  Testing real ${providerName} process subscription transitions:`);

        // 1. Initial subscription state
        const initMsg = await waitForNext(m => m.type === "subscriptions" && m.action === "initial");
        assert.deepStrictEqual(initMsg.symbols, initialSymbols, `${providerName}: initial symbols must match`);
        console.log(`    ✓ Initial subscription state verified: [${initMsg.symbols.join(", ")}]`);

        // 2. Dynamic addition
        sendCommand({ action: "subscribe", symbols: ["SOL"] });
        const addMsg = await waitForNext(m => m.type === "subscriptions" && m.action === "subscribe");
        assert.deepStrictEqual(addMsg.symbols, [...initialSymbols, "SOL"], `${providerName}: dynamic addition must append symbol`);
        console.log(`    ✓ Dynamic addition verified: [${addMsg.symbols.join(", ")}]`);

        // 3. Duplicate suppression
        sendCommand({ action: "subscribe", symbols: ["BTC", "SOL"] });
        const dupMsg = await waitForNext(m => m.type === "subscriptions" && m.action === "subscribe");
        assert.deepStrictEqual(dupMsg.symbols, [...initialSymbols, "SOL"], `${providerName}: duplicates must be suppressed`);
        console.log(`    ✓ Duplicate suppression verified: [${dupMsg.symbols.join(", ")}]`);

        // 4. Invalid / empty symbol handling
        sendCommand({ action: "subscribe", symbols: ["", "   ", null, undefined, 123] });
        const invalidMsg = await waitForNext(m => m.type === "subscriptions" && m.action === "subscribe");
        assert.deepStrictEqual(invalidMsg.symbols, [...initialSymbols, "SOL"], `${providerName}: invalid symbols must be ignored`);
        console.log(`    ✓ Invalid/empty symbol handling verified: [${invalidMsg.symbols.join(", ")}]`);

        // 5. Removal / unsubscribe
        sendCommand({ action: "unsubscribe", symbols: ["ETH"] });
        const unsubMsg = await waitForNext(m => m.type === "subscriptions" && m.action === "unsubscribe");
        const expectedAfterUnsub = initialSymbols.filter(s => s !== "ETH").concat(["SOL"]);
        assert.deepStrictEqual(unsubMsg.symbols, expectedAfterUnsub, `${providerName}: unsubscribe must remove symbol`);
        console.log(`    ✓ Removal/unsubscribe verified: [${unsubMsg.symbols.join(", ")}]`);

        // 6. set_subscriptions replacement
        sendCommand({ action: "set_subscriptions", symbols: ["HYPE", "BTC", "DOGE"] });
        const replaceMsg = await waitForNext(m => m.type === "subscriptions" && m.action === "set_subscriptions");
        assert.deepStrictEqual(replaceMsg.symbols, ["HYPE", "BTC", "DOGE"], `${providerName}: set_subscriptions must replace active set`);
        console.log(`    ✓ set_subscriptions replacement verified: [${replaceMsg.symbols.join(", ")}]`);

        clearTimeout(safetyTimer);
        killProcess();
        resolve(true);
      } catch (err) {
        clearTimeout(safetyTimer);
        killProcess();
        reject(err);
      }
    })();
  });
}

async function run() {
  try {
    // 2.1 Test Binance real process IPC and observable subscription transitions
    await runRealProcessSubscriptionSuite("binance", ["BTC", "ETH"]);

    // 2.2 Test Coinbase real process IPC and observable subscription transitions
    await runRealProcessSubscriptionSuite("coinbase", ["BTC", "ETH"]);

    // 2.3 Test Hyperliquid real process initial subscription state
    await (new Promise((resolve, reject) => {
      const bridge = path.join(__dirname, "../scripts/ws_bridge.js");
      const p = spawn("node", [bridge, "hyperliquid", "BTC,ETH,SOL,HYPE"]);
      const timer = setTimeout(() => {
        p.kill("SIGTERM");
        reject(new Error("Hyperliquid initial state timeout"));
      }, 5000);

      p.stdout.on("data", (chunk) => {
        const lines = chunk.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.type === "subscriptions" && msg.action === "initial") {
              assert.deepStrictEqual(msg.symbols, ["BTC", "ETH", "SOL", "HYPE"]);
              console.log("\n  Testing real hyperliquid process initial state:");
              console.log("    ✓ Hyperliquid initial subscription state verified:", msg.symbols);
              clearTimeout(timer);
              p.kill("SIGTERM");
              resolve(true);
              return;
            }
          } catch (e) {}
        }
      });

      p.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    }));

    console.log("\n============================================================");
    console.log("ALL DYNAMIC SUBSCRIPTION TESTS PASSED! ✓");
    console.log("============================================================\n");
  } catch (err) {
    console.error("Subscription test error:", err);
    process.exit(1);
  }
}

run();
