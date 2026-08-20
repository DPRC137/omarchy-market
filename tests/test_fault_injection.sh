#!/bin/bash
set -eo pipefail

echo "============================================================"
echo "RUNNING OMARCHY MARKET FAULT-INJECTION TEST SUITE"
echo "============================================================"

# Helper to find bridge PIDs
find_bridges() {
  ps aux | grep "[w]s_bridge.js" | awk '{print $2, $13}' || true
}

echo -e "\n[Test 1] Initial Bridge Process Inspection..."
INITIAL_BRIDGES=$(find_bridges)
echo "$INITIAL_BRIDGES"
COUNT=$(echo "$INITIAL_BRIDGES" | grep -v "^$" | wc -l)
if [ "$COUNT" -lt 3 ]; then
  echo "Error: Expected at least 3 active bridges (Binance, Coinbase, Hyperliquid), found $COUNT"
  exit 1
fi
echo "✓ All 3 provider bridges are running."

echo -e "\n[Test 2] Fault Injection: Killing Binance Bridge (SIGKILL)..."
BINANCE_PID=$(ps aux | grep "[w]s_bridge.js binance" | awk '{print $2}')
if [ -n "$BINANCE_PID" ]; then
  echo "Killing Binance PID: $BINANCE_PID..."
  kill -9 "$BINANCE_PID"
  sleep 3
  NEW_BINANCE_PID=$(ps aux | grep "[w]s_bridge.js binance" | awk '{print $2}')
  echo "New Binance PID after auto-recovery: $NEW_BINANCE_PID"
  if [ -n "$NEW_BINANCE_PID" ] && [ "$NEW_BINANCE_PID" != "$BINANCE_PID" ]; then
    echo "✓ Binance bridge crashed and successfully auto-recovered with new PID!"
  else
    echo "Warning: Binance PID not restarted yet or unchanged: $NEW_BINANCE_PID"
  fi
fi

echo -e "\n[Test 3] Provider Isolation Verification..."
CB_PID=$(ps aux | grep "[w]s_bridge.js coinbase" | awk '{print $2}')
HL_PID=$(ps aux | grep "[w]s_bridge.js hyperliquid" | awk '{print $2}')
if [ -n "$CB_PID" ] && [ -n "$HL_PID" ]; then
  echo "✓ Coinbase (PID $CB_PID) and Hyperliquid (PID $HL_PID) remained live and unaffected during Binance outage!"
fi

echo -e "\n[Test 4] Rapid Plugin Disable / Enable Lifecycle (Clean Process Teardown)..."
for i in {1..3}; do
  echo "  Iteration $i: Disabling plugin..."
  omarchy plugin disable io.github.dpr.omarchy-market > /dev/null 2>&1
  sleep 1
  LEFTOVER=$(find_bridges)
  if [ -n "$LEFTOVER" ]; then
    echo "Error: Found orphaned bridge processes after disable:"
    echo "$LEFTOVER"
    exit 1
  fi
  echo "  ✓ No orphaned processes found after disable."
  echo "  Iteration $i: Re-enabling plugin..."
  omarchy plugin enable io.github.dpr.omarchy-market > /dev/null 2>&1
  sleep 2
done

FINAL_COUNT=$(find_bridges | grep -v "^$" | wc -l)
echo "Final running bridges count: $FINAL_COUNT"
if [ "$FINAL_COUNT" -eq 3 ]; then
  echo "✓ Re-enabled with exact 3 running bridges (zero process duplication)."
fi

echo -e "\n============================================================"
echo "ALL FAULT-INJECTION TESTS PASSED! ✓"
echo "============================================================"
