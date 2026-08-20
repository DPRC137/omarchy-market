# Omarchy Market Testing & Quality Assurance Guide

## 1. Automated Test Suite

Run the full local validation and deterministic test suite:

```bash
./tests/run_tests.sh
```

### Included Tests
1. **Manifest Schema Validation**: `omarchy plugin validate .`
   - Verifies `schemaVersion: 1`, non-reserved ID (`io.github.dpr.omarchy-market`), valid entryPoints, and proper settings schemas.
2. **QML Static Analysis**: `qmllint -I /usr/share/omarchy/shell`
   - Evaluates all `.qml` files (`MarketService.qml`, `BarWidget.qml`, `Panel.qml`, `providers/*.qml`, `ui/*.qml`) with 0 syntax errors or warnings.
3. **Deterministic Normalization & Formatting Unit Tests** (`tests/test_models.js`):
   - Binance 24h ticker normalization (Spot).
   - Coinbase Advanced Trade ticker normalization (Spot).
   - Hyperliquid meta and context normalization (including native `HYPE`).
   - Explicit Reference Spot pricing & DEX routing.
   - Freshness threshold calculations (`LIVE`, `STALE`, `OFFLINE`).
   - Number and currency formatting utilities.
4. **Fixture Resilience & Edge Case Tests** (`tests/test_fixtures.js`):
   - Null / undefined payload safety.
   - Malformed numbers and NaN recovery.
   - Unknown asset symbol filtering.
   - Provider failure isolation (dead feeds excluded from reference pricing).

---

## 2. Fault-Injection Test Suite

Run the automated fault-injection suite:

```bash
./tests/test_fault_injection.sh
```

### Validated Fault Scenarios
- **Bridge Crash Recovery**: Simulates a crash of a bridge process (`SIGKILL`). Verifies that QML detects the exit, transitions status to `RECONNECTING`, and automatically restarts the bridge with exponential backoff and jitter.
- **Provider Failure Isolation**: Kills Binance while Coinbase and Hyperliquid remain live. Verifies that the other feeds continue updating uninterrupted, and Reference Spot Price dynamically falls back to Coinbase.
- **Clean Lifecycle Teardown**: Rapidly disables and re-enables the plugin 3 times in succession. Confirms that 0 orphaned child processes or leaked sockets remain after disable, and exactly 3 processes are re-spawned upon enable.

---

## 3. Live Integration & Soak Testing

### Live Exchange Verification
```bash
./scripts/live-test.sh
```
Establishes real TLS WebSocket streams against live public endpoints for Binance, Coinbase, and Hyperliquid.

### Resource & Soak Monitoring
```bash
./tests/measure_resources.sh
```
Measures live RSS memory, CPU percentage, PID lifecycles, and open network sockets.
