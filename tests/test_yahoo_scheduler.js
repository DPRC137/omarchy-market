// test_yahoo_scheduler.js - Deterministic scheduler, priority, deduplication, and 429 backoff tests

const assert = require('assert');

console.log("=== RUNNING YAHOO SCHEDULER & RATE LIMITER TESTS ===");

class MockYahooScheduler {
  constructor(options = {}) {
    this.minRequestSpacingMs = options.minRequestSpacingMs || 50; // accelerated for fast unit test
    this.requestTimeoutMs = options.requestTimeoutMs || 500;
    this.queue = [];
    this.inFlight = false;
    this.inFlightTask = null;
    this.isBackingOff = false;
    this.backoffAttempts = 0;
    this.activeHttpRequests = 0;
    this.maxConcurrentHttp = 0;
    this.executedTasks = [];
    this.mockNetworkHandler = null;
    this.timer = null;
  }

  enqueueTask(task) {
    // Deduplication check against in-flight
    if (this.inFlightTask) {
      if (task.type === "quote" && this.inFlightTask.type === "quote" && this.inFlightTask.asset === task.asset) {
        return false;
      }
      if (task.type === "candle" && this.inFlightTask.type === "candle" && this.inFlightTask.asset === task.asset && this.inFlightTask.timeframe === task.timeframe) {
        return false;
      }
    }

    // Deduplication check against queued
    for (let i = 0; i < this.queue.length; i++) {
      const q = this.queue[i];
      if (task.type === "quote" && q.type === "quote" && q.asset === task.asset) {
        return false;
      }
      if (task.type === "candle" && q.type === "candle" && q.asset === task.asset && q.timeframe === task.timeframe) {
        return false;
      }
    }

    // Prioritized insertion (quotes: 10 before candles: 5)
    let inserted = false;
    for (let j = 0; j < this.queue.length; j++) {
      if (task.priority > this.queue[j].priority) {
        this.queue.splice(j, 0, task);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.queue.push(task);
    }
    return true;
  }

  processQueue() {
    if (this.inFlight || this.isBackingOff || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    this.inFlight = true;
    this.inFlightTask = task;
    this.activeHttpRequests++;
    if (this.activeHttpRequests > this.maxConcurrentHttp) {
      this.maxConcurrentHttp = this.activeHttpRequests;
    }

    const handler = this.mockNetworkHandler || ((t, cb) => setTimeout(() => cb({ status: 200, data: {} }), 10));

    handler(task, (response) => {
      this.activeHttpRequests--;
      this.executedTasks.push({ task, timestamp: Date.now(), responseStatus: response.status });

      if (response.status === 200) {
        this.inFlight = false;
        this.inFlightTask = null;
        this.backoffAttempts = 0;
        setTimeout(() => this.processQueue(), this.minRequestSpacingMs);
      } else if (response.status === 429 || response.status === 403 || response.status >= 500) {
        this.inFlight = false;
        this.inFlightTask = null;
        this.isBackingOff = true;
        this.backoffAttempts++;
        const backoffDelay = Math.min(500, this.backoffAttempts * 100);
        setTimeout(() => {
          this.isBackingOff = false;
          this.processQueue();
        }, backoffDelay);
      } else {
        this.inFlight = false;
        this.inFlightTask = null;
        setTimeout(() => this.processQueue(), this.minRequestSpacingMs);
      }
    });
  }
}

async function runSchedulerTests() {
  // Test 1: Single In-Flight Request Invariant
  const s1 = new MockYahooScheduler({ minRequestSpacingMs: 20 });
  for (let i = 0; i < 5; i++) {
    s1.enqueueTask({ type: "quote", asset: "SYM" + i, priority: 10 });
  }
  s1.processQueue();

  await new Promise(r => setTimeout(r, 250));
  assert.strictEqual(s1.executedTasks.length, 5);
  assert.strictEqual(s1.maxConcurrentHttp, 1, "There must never be more than 1 concurrent HTTP request");
  console.log("✓ Yahoo Single-Request Invariant verified (maxConcurrentHttp = 1)");

  // Test 2: Priority Ordering (Quotes > Candles)
  const s2 = new MockYahooScheduler({ minRequestSpacingMs: 20 });
  s2.enqueueTask({ type: "candle", asset: "AAPL", timeframe: "1D", priority: 5 });
  s2.enqueueTask({ type: "candle", asset: "MSFT", timeframe: "1D", priority: 5 });
  s2.enqueueTask({ type: "quote", asset: "NVDA", priority: 10 }); // Enqueued after candles, but higher priority

  s2.processQueue();
  await new Promise(r => setTimeout(r, 200));

  assert.strictEqual(s2.executedTasks.length, 3);
  assert.strictEqual(s2.executedTasks[0].task.asset, "NVDA", "NVDA quote must execute first despite being enqueued later");
  assert.strictEqual(s2.executedTasks[0].task.type, "quote");
  assert.strictEqual(s2.executedTasks[1].task.asset, "AAPL");
  assert.strictEqual(s2.executedTasks[2].task.asset, "MSFT");
  console.log("✓ Request priority ordering verified (Quotes execute before Candles)");

  // Test 3: Deduplication
  const s3 = new MockYahooScheduler({ minRequestSpacingMs: 20 });
  const added1 = s3.enqueueTask({ type: "quote", asset: "AAPL", priority: 10 });
  const added2 = s3.enqueueTask({ type: "quote", asset: "AAPL", priority: 10 }); // duplicate
  const added3 = s3.enqueueTask({ type: "candle", asset: "AAPL", timeframe: "1H", priority: 5 });
  const added4 = s3.enqueueTask({ type: "candle", asset: "AAPL", timeframe: "1H", priority: 5 }); // duplicate

  assert.strictEqual(added1, true);
  assert.strictEqual(added2, false);
  assert.strictEqual(added3, true);
  assert.strictEqual(added4, false);
  assert.strictEqual(s3.queue.length, 2);
  console.log("✓ Request deduplication verified");

  // Test 4: HTTP 429 Defensive Backoff
  const s4 = new MockYahooScheduler({ minRequestSpacingMs: 20 });
  let reqCount = 0;
  s4.mockNetworkHandler = (task, cb) => {
    reqCount++;
    if (task.asset === "AAPL") {
      // Return 429 rate limit for AAPL
      setTimeout(() => cb({ status: 429 }), 10);
    } else {
      setTimeout(() => cb({ status: 200 }), 10);
    }
  };

  s4.enqueueTask({ type: "quote", asset: "AAPL", priority: 10 });
  s4.enqueueTask({ type: "quote", asset: "MSFT", priority: 10 });
  s4.processQueue();

  // Check immediately after AAPL request returns 429
  await new Promise(r => setTimeout(r, 25));
  assert.strictEqual(s4.isBackingOff, true, "Scheduler must be in backoff mode after HTTP 429");
  assert.strictEqual(s4.executedTasks.length, 1, "MSFT must not execute during backoff");

  // Wait for backoff delay (100ms) to complete
  await new Promise(r => setTimeout(r, 180));
  assert.strictEqual(s4.isBackingOff, false, "Scheduler must resume after backoff");
  assert.strictEqual(s4.executedTasks.length, 2, "MSFT must execute after backoff finishes");
  assert.strictEqual(s4.executedTasks[1].task.asset, "MSFT");
  console.log("✓ HTTP 429 defensive backoff and queue resumption verified");

  console.log("\nALL YAHOO SCHEDULER TESTS PASSED! ✓\n");
}

runSchedulerTests().catch(err => {
  console.error("Scheduler test failed:", err);
  process.exit(1);
});
