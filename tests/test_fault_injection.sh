#!/usr/bin/env bash
# Deterministic faults against production modules; does not kill or disable
# anything in the user's running shell.
set -euo pipefail
cd "$(dirname "$0")/.."
node tests/test_runtime_faults.js
node tests/test_yahoo_scheduler.js
node tests/test_history.js
node tests/test_subscriptions.js
