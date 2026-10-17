# Omarchy Market (`io.github.dpr.omarchy-market`)

A lightweight native market watchlist and ticker for **Omarchy Quattro**.
No accounts, API keys, npm packages, or background daemons.

![Preview](preview.png)

## Watchlist and detail

Click the bar ticker to open that instrument’s chart directly. Back shows compact
watchlist rows. Select any row for source-labelled
prices, regular-session equity metrics or rolling 24-hour crypto metrics, native
Canvas history, and an expandable Spot/Perp comparison. Back returns to the list.
Manage searches the local catalog and Yahoo stocks/ETFs; arrows and Enter add
results, and removed rows have Undo. Up/down controls preserve watchlist order.
Up to 20 instruments are supported; existing watchlists migrate in place.

Headlines and history share one explicit instrument: Binance **USDT spot**,
Yahoo equities in their **reported currency**, or Hyperliquid **HYPE USDC perpetual**.
USD and USDT are distinguished; sources are never averaged or silently replaced
with perpetual prices. HYPE's headline is mark price; its candle closes are trades.
Missing data appears as `—`. Equity volume is shares, not dollars.

Connection state, quote age and session status are separate. Last-known values
stay visible with age and freshness when a feed fails. History has loading,
unavailable, stale-cache and retry states. `1D / 1W / 1M / 1Y` mean consistent
calendar spans, with actual dates, interval and source shown beneath the chart.
See [exact semantics](docs/SEMANTICS.md).

## Requirements

- Omarchy Quattro, Quickshell **0.3+**, Qt **6.8+**.
- Node.js **22.4+** with native WebSocket enabled (24/26 also supported).
- Public internet access to provider APIs. Yahoo's endpoints are unofficial;
  availability, limits, delays and coverage may change without notice.

Binance/Coinbase streams use child Node processes owned by the plugin; those
stop when unwatched or disabled. Hyperliquid uses HTTP polling. Stock-only
watchlists start no crypto bridges. No extra service or systemd unit is installed.

## Installation

```bash
omarchy plugin add https://github.com/DPRC137/omarchy-market.git --enable --yes
```

Manual installation:

```bash
git clone https://github.com/DPRC137/omarchy-market.git ~/.config/omarchy/plugins/io.github.dpr.omarchy-market
omarchy-shell shell rescanPlugins
omarchy plugin enable io.github.dpr.omarchy-market
```

Remove with `omarchy plugin remove io.github.dpr.omarchy-market`.

## Controls and settings

- Bar left-click: chart for the displayed instrument. Back opens the watchlist. Middle-click: refresh quotes and any visible
  history. Right-click: cycle and pin a bar instrument.
- Detail **Pin to bar**: choose a stable asset. Rotation is off by default and
  can be enabled in Manage. The bar fits its text, and hovering keeps neighboring indicator reveals from
  shifting it. Crypto bar prices omit quote codes; tooltip and detail preserve them.
- **Tab / Shift+Tab**: move between controls and rows. **Enter / Space** activates.
- **Escape**: Back from detail/Manage, then close. **R** refreshes outside search;
  **/** opens Manage and focuses search. Search supports Up/Down and Enter.
- Hover the chart for actual candle time and price.

Existing `shell.json` widget settings remain supported:

```json
{ "id": "io.github.dpr.omarchy-market", "multiAsset": false, "speed": 4000 }
```

`multiAsset` shows up to two instruments; `speed` controls optional rotation.
Watchlist order, discovered equity metadata, pin and rotation use the original
Qt Settings category `io.github.dpr.omarchy-market`; no shell.json rewrite is
required. [Architecture and persistence](docs/ARCHITECTURE.md).

## Development

```bash
bash tests/run_tests.sh       # portable production-module checks, also run in CI
bash tests/lint_qml.sh        # Qt/Quattro imports required
node tests/run_native.js      # real QML XHR, deadlines, settings restart, cleanup
node tests/run_ui.js          # real Wayland popup, pointer and keyboard checks
node tests/run_ui.js ticker   # compact bar, hover, direct asset chart and rotation
./scripts/live-test.sh        # optional external WebSocket connectivity
```

Native tests use temporary settings and leave the installed shell intact.
See [testing and limitations](docs/TESTING.md). Node tests alone do not establish
that the native UI works.
