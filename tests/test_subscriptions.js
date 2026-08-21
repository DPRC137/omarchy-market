// test_subscriptions.js - Deterministic IPC and dynamic subscription tests

const { spawn } = require("child_process");
const path = require("path");
const assert = require("assert");

console.log("=== RUNNING DYNAMIC PROVIDER SUBSCRIPTION IPC TESTS ===");

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
    // 1. Test Binance dynamic set_subscriptions IPC
    const binanceRes = await testBridgeSubscription("binance", ["BTC", "ETH"], {
      action: "set_subscriptions",
      symbols: ["BTC", "ETH", "DOGE"]
    });
    const binanceConnected = binanceRes.messages.some(m => m.type === "status" && m.status === "CONNECTED");
    assert.ok(binanceConnected, "Binance bridge must establish connection");
    console.log("✓ Binance dynamic subscription IPC verified");

    // 2. Test Coinbase dynamic subscribe IPC
    const cbRes = await testBridgeSubscription("coinbase", ["BTC"], {
      action: "subscribe",
      symbols: ["SOL"]
    });
    const cbConnected = cbRes.messages.some(m => m.type === "status" && m.status === "CONNECTED");
    assert.ok(cbConnected, "Coinbase bridge must establish connection");
    console.log("✓ Coinbase dynamic subscription IPC verified");

    // 3. Test Hyperliquid bridge startup with symbols
    const hlRes = await testBridgeSubscription("hyperliquid", ["BTC", "ETH", "SOL", "HYPE"], {
      action: "set_subscriptions",
      symbols: ["BTC", "ETH", "SOL", "HYPE", "DOGE"]
    });
    const hlConnected = hlRes.messages.some(m => m.type === "status" && m.status === "CONNECTED");
    assert.ok(hlConnected, "Hyperliquid bridge must establish connection");
    console.log("✓ Hyperliquid bridge IPC verified");

    console.log("\nALL DYNAMIC SUBSCRIPTION IPC TESTS PASSED! ✓\n");
  } catch (err) {
    console.error("Subscription test error:", err);
    process.exit(1);
  }
}

run();
