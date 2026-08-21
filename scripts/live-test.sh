#!/bin/bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node "$DIR/tests/test_live_ws.js"
node "$DIR/tests/test_subscriptions.js"

