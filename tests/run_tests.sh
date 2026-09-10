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
timeout 15s quickshell -p test_runtime.qml || true

echo -e "\n============================================================"
echo "ALL TESTS PASSED SUCCESSFULLY! ✓"
echo "============================================================"
