// Standalone WebSocket transport proof for Binance, Coinbase, Hyperliquid
// Uses native standard WebSocket (built-in Node v26 runtime, zero dependencies)

console.log("=== MILESTONE 0.5: WEBSOCKET TRANSPORT PROOF ===");

async function testBinance() {
  return new Promise((resolve, reject) => {
    console.log("\n[1/3] Testing Binance WebSocket Stream...");
    const url = "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/solusdt@ticker";
    const ws = new WebSocket(url);
    let messageCount = 0;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Binance WebSocket timed out"));
    }, 8000);

    ws.onopen = () => {
      console.log("  ✓ Binance WS handshake connected (Open)");
    };

    ws.onmessage = (event) => {
      messageCount++;
      const payload = JSON.parse(event.data);
      console.log(`  ✓ Binance received frame #${messageCount}: stream=${payload.stream}, price=${payload.data.c}, 24h%=${payload.data.P}`);
      if (messageCount >= 2) {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };
  });
}

async function testCoinbase() {
  return new Promise((resolve, reject) => {
    console.log("\n[2/3] Testing Coinbase Advanced Trade WebSocket Stream...");
    const url = "wss://ws-feed.exchange.coinbase.com";
    const ws = new WebSocket(url);
    let messageCount = 0;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Coinbase WebSocket timed out"));
    }, 8000);

    ws.onopen = () => {
      console.log("  ✓ Coinbase WS connected (Open)");
      const subMsg = JSON.stringify({
        type: "subscribe",
        product_ids: ["BTC-USD", "ETH-USD", "SOL-USD"],
        channels: ["ticker"]
      });
      console.log("  -> Sending subscription frame:", subMsg);
      ws.send(subMsg);
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "subscriptions") {
        console.log("  ✓ Coinbase subscription confirmed:", JSON.stringify(payload.channels));
      } else if (payload.type === "ticker") {
        messageCount++;
        console.log(`  ✓ Coinbase ticker #${messageCount}: product=${payload.product_id}, price=$${payload.price}, best_bid=$${payload.best_bid}, best_ask=$${payload.best_ask}`);
        if (messageCount >= 2) {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };
  });
}

async function testHyperliquid() {
  return new Promise((resolve, reject) => {
    console.log("\n[3/3] Testing Hyperliquid WebSocket Stream...");
    const url = "wss://api.hyperliquid.xyz/ws";
    const ws = new WebSocket(url);
    let messageCount = 0;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Hyperliquid WebSocket timed out"));
    }, 8000);

    ws.onopen = () => {
      console.log("  ✓ Hyperliquid WS connected (Open)");
      const subMsg = JSON.stringify({
        method: "subscribe",
        subscription: { type: "allMids" }
      });
      console.log("  -> Sending allMids subscription frame:", subMsg);
      ws.send(subMsg);

      // Also test ping message
      ws.send(JSON.stringify({ method: "ping" }));
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.channel === "pong") {
        console.log("  ✓ Hyperliquid pong received successfully!");
      } else if (payload.channel === "subscriptionResponse") {
        console.log("  ✓ Hyperliquid subscription response:", JSON.stringify(payload.data));
      } else if (payload.channel === "allMids") {
        messageCount++;
        const mids = payload.data.mids;
        console.log(`  ✓ Hyperliquid allMids #${messageCount}: HYPE=$${mids.HYPE || mids['@107'] || 'N/A'}, BTC=$${mids.BTC}, ETH=$${mids.ETH}, SOL=$${mids.SOL}`);
        if (messageCount >= 2) {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };
  });
}

async function run() {
  try {
    await testBinance();
    await testCoinbase();
    await testHyperliquid();
    console.log("\n============================================================");
    console.log("✓ ALL 3 WEBSOCKET FEEDS VERIFIED LIVE & OPERATIONAL!");
    console.log("============================================================\n");
  } catch (e) {
    console.error("WebSocket test failed:", e);
    process.exit(1);
  }
}

run();
