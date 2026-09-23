#!/bin/bash
set -eo pipefail

echo "============================================================"
echo "RUNNING OMARCHY MARKET TEST & VALIDATION SUITE"
echo "============================================================"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo -e "\n1. Validating manifest..."
omarchy plugin validate .
echo "✓ Manifest validation passed"

echo -e "\n2. Running qmllint..."
qmllint -I /usr/share/omarchy/shell \
  MarketService.qml \
  BarWidget.qml \
  Panel.qml \
  providers/BinanceProvider.qml \
  providers/CoinbaseProvider.qml \
  providers/HyperliquidProvider.qml \
  providers/YahooProvider.qml \
  ui/SparklineChart.qml \
  test_runtime.qml
echo "✓ QML lint passed (0 errors)"

echo -e "\n3. Running deterministic unit tests..."
node tests/test_models.js
node tests/test_fixtures.js
node tests/test_subscriptions.js
node tests/test_yahoo_scheduler.js
node tests/test_runtime_faults.js
node tests/test_v121_regressions.js

echo -e "\n4. Running real Quickshell runtime audit..."
MARKER="/tmp/omarchy_market_audit_success"
rm -f "$MARKER"

set +e
timeout 15s quickshell -p test_runtime.qml
QS_EXIT=$?
set -e

# Expected termination is 137 (128 + 9 = SIGKILL from intentional self-termination process)
if [ "$QS_EXIT" -ne 137 ]; then
  if [ "$QS_EXIT" -eq 124 ]; then
    echo "ERROR: Quickshell runtime audit timed out after 15 seconds!"
  else
    echo "ERROR: Quickshell runtime audit exited with unexpected status $QS_EXIT (expected 137 from self-termination)"
  fi
  rm -f "$MARKER"
  exit 1
fi

if [ ! -f "$MARKER" ]; then
  echo "ERROR: Quickshell terminated but success marker was not created (audit assertions failed)!"
  exit 1
fi

rm -f "$MARKER"
echo "✓ Quickshell runtime audit passed with clean termination and verified success marker."

echo -e "\n============================================================"
echo "ALL TESTS PASSED SUCCESSFULLY! ✓"
echo "============================================================"
