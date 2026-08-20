#!/bin/bash
# scripts/live-test.sh - Optional live exchange integration test

set -eo pipefail

echo "============================================================"
echo "RUNNING LIVE EXCHANGE INTEGRATION TEST"
echo "============================================================"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

node tests/test_live_ws.js

echo "Live integration test completed successfully."
