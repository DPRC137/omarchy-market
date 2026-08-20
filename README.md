# Omarchy Market (`io.github.dpr.omarchy-market`) v1.0.0

A production-quality, native financial market data ticker and compact terminal plugin for **Omarchy Quattro**.

---

## Features

- **Live Streaming Ticker**: Displays real-time crypto prices directly on the Omarchy bar (`BTC`, `ETH`, `SOL`, `HYPE`).
- **Multi-Exchange Feeds**:
  - **Binance**: Public spot ticker WebSocket stream & REST klines.
  - **Coinbase**: Coinbase Exchange public ticker WebSocket stream & REST stats.
  - **Hyperliquid**: Real-time mid prices & market contexts (native home of `HYPE`).
- **Distinct Instrument & Pricing Engine**:
  - Distinguishes spot markets (`BTC/USDT`, `BTC/USD`) from perpetuals (`HYPE`, `BTC-PERP`).
  - Calculates Reference Spot Price across active spot feeds without cross-market distortion.
  - Routes `HYPE` directly to its native DEX feed.
- **Compact Market Terminal Panel**:
  - Large price display with color-coded 24h change & freshness indicator (`LIVE`, `STALE`, `OFFLINE`).
  - 24h High, Low, and USD Volume statistics.
  - Multi-exchange comparison table showing live prices across Binance, Coinbase, and Hyperliquid.
  - Native QML Canvas sparkline chart with timeframe selectors (`1H`, `4H`, `1D`, `1W`).
- **Zero Cost & Zero Daemon**:
  - $0 operating cost, zero API keys required, zero paid backends.
  - No background daemons, no extra Quickshell processes, no systemd units, no sudo needed.
- **Resilient & Isolated**:
  - Automatic reconnection with exponential backoff and jitter.
  - Independent provider failure isolation (one exchange going down does not disrupt the others).
  - Clean process teardown on disable or shell reload with zero orphaned child processes.

---

## Prerequisites & Dependencies

- **Desktop Shell**: Omarchy Quattro (`omarchy-shell` / Quickshell `0.3.0`+, Qt `6.8`+).
- **Runtime Transport**: `node` (Node.js v20+, v22+, or v26+ with native WHATWG `WebSocket` support, 0 npm packages required).

---

## Installation

### Method 1: Automatic via Omarchy CLI
```bash
omarchy plugin add https://github.com/DPRC137/omarchy-market.git --enable --yes
```

### Method 2: Manual Installation
1. Clone or copy into your Omarchy plugins directory:
   ```bash
   git clone https://github.com/DPRC137/omarchy-market.git ~/.config/omarchy/plugins/io.github.dpr.omarchy-market
   ```
2. Rescan and enable:
   ```bash
   omarchy-shell shell rescanPlugins
   omarchy plugin enable io.github.dpr.omarchy-market
   ```

---

## Usage & Controls

- **Left-Click** on the ticker: Opens / closes the compact Market Terminal popup.
- **Middle-Click**: Forces an immediate market data refresh across all providers.
- **Right-Click**: Cycles the active single-asset display in compact mode.
- **Keyboard in Terminal**:
  - `Tab` / `Shift+Tab`: Switch between asset tabs (`BTC`, `ETH`, `SOL`, `HYPE`).
  - `R`: Refresh market data.
  - `Escape`: Close terminal popup.

---

## Configuration (`shell.json`)

Settings can be customized directly in `~/.config/omarchy/shell.json`:

```json
{
  "id": "io.github.dpr.omarchy-market",
  "compact": false,
  "speed": 4000
}
```

- `compact` *(boolean)*: Toggle between full multi-asset scrolling ticker and single-asset compact cycling mode.
- `speed` *(number)*: Multi-asset cycling interval in milliseconds (default: `4000`).

---

## Development & Testing

- Run the automated test suite:
  ```bash
  ./tests/run_tests.sh
  ```
- Run fault-injection tests:
  ```bash
  ./tests/test_fault_injection.sh
  ```
- Run live integration connectivity tests:
  ```bash
  ./scripts/live-test.sh
  ```
- Monitor live resource usage:
  ```bash
  ./tests/measure_resources.sh
  ```
