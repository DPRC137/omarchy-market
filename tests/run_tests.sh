#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for file in scripts/*.js tests/*.js; do node --check "$file"; done
for test in test_models test_fixtures test_runtime_faults test_yahoo_scheduler test_history test_equity_sessions test_subscriptions test_recovery test_watchlist_view test_history_stats test_chart_geometry; do
  node "tests/$test.js"
done
for script in tests/*.sh scripts/*.sh; do bash -n "$script"; done
node -e 'const fs=require("fs"),m=JSON.parse(fs.readFileSync("manifest.json")); for(const p of Object.values(m.entryPoints)) if(!fs.existsSync(p)) throw Error(p); if(m.schemaVersion!==1) throw Error("manifest schema");'
echo 'PASS portable checks (native validation: node tests/run_native.js)'
