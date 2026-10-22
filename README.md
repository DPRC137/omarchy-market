# Omarchy Market (`io.github.dpr.omarchy-market`)

A lightweight native market watchlist and ticker for **Omarchy Quattro**.
No accounts, API keys or background daemons. The WebSocket client ships in the checkout.

[**Version 1.4.2**](CHANGELOG.md#142--2026-10-22) · [Changelog](CHANGELOG.md) · [Data semantics](docs/SEMANTICS.md)

![Omarchy Market: crypto, stocks and ETFs in a native desktop plugin, with session-aware charts, date-window statistics and watchlist management](preview.png)

## What's new in 1.4.2

- **Bounded WebSocket input:** ticker messages stop at 16 KiB before assembly
  and JSON parsing, including oversized fragmented messages.
- **Small, bounded shell messages:** only watched price/stat fields cross into
  the desktop shell; unused remote fields are discarded and output is bounded.
- **No installation step added:** the pinned, MIT-licensed ws client is bundled
  with optional native addons and compression disabled.

[WebSocket security limits and regressions](docs/WEBSOCKET_SECURITY.md).

### Included reliability fixes

- **Reliable quote and chart recovery:** fresh HTTP connections keep retries
  independent of stalled connections in the desktop shell.
- **Bounded downloads:** search stops at 128 KiB and quote/history responses at
  1 MiB while streaming, including responses without Content-Length.
- **Qt 6.12 compatibility:** explicit shell-palette imports keep native colors
  working with QtQuick's new Color type.

Existing watchlists, pin and rotation settings are preserved. See the
[network recovery analysis and validation](docs/NETWORK_RECOVERY.md).

### Native UI highlights

- **Redesigned native UI:** filter and sort a compact watchlist, browse categories,
  and keep navigation within reach while scrolling detail and Manage.
- **Continuous market charts:** equity observations use trading-session spacing,
  smooth curves through recorded closes, readable price ticks and exact inspection.
- **Stats for your date window:** 1D/1W/1M/1Y change, high/low/average close,
  observed dates and sample count. Daily/session metrics remain separately available.
- **An organized watchlist:** search, contextual edit actions, keyboard reordering,
  remove/Undo, a pinned bar ticker and optional rotation.
- **Existing settings retained:** keep your watchlist and preferences. Automatic
  stale-feed recovery from 1.3.1 is included when upgrading the older listing.

## Screenshots

The preview above is generated promotional artwork using actual UI captures.
The original screenshots below are unedited native Quickshell/Quattro cards in
the active dark theme, all captured at the same 600×800 window size. Every screen
waits for live quotes, history and search to finish loading. Prices are examples
from capture time. The gallery was captured for 1.4.0 and shows the same native
interface included in the current 1.4.x release; its original capture provenance is retained.

| Watchlist | Asset detail |
| --- | --- |
| <img src="docs/screenshots/v1.4.0/watchlist.png" alt="Native watchlist with filter, categories, sorting, source currencies and freshness" width="420"> | <img src="docs/screenshots/v1.4.0/aapl-month.png" alt="AAPL monthly chart with continuous session spacing and selected-window closing-price statistics" width="420"> |

| Manage | Search |
| --- | --- |
| <img src="docs/screenshots/v1.4.0/manage.png" alt="Search, contextual watchlist editing and bar display preferences" width="420"> | <img src="docs/screenshots/v1.4.0/search.png" alt="Native symbol and name search with explicit addition state" width="420"> |

| Crypto chart | Latest equity session |
| --- | --- |
| <img src="docs/screenshots/v1.4.0/crypto-week.png" alt="BTC weekly trade-close chart with USDT price and selected-window statistics" width="420"> | <img src="docs/screenshots/v1.4.0/equity-session.png" alt="TSLA latest regular-session chart with date and selected-window close statistics" width="420"> |

[Full seven-image gallery and provenance](docs/screenshots/v1.4.0/README.md) ·
[Redesign verification and limits](docs/NATIVE_REDESIGN.md).

## Watchlist and detail

Click the bar ticker to open that instrument’s chart directly. Back shows compact
watchlist rows. Select any row for source-labelled
prices, regular-session equity metrics or rolling 24-hour crypto metrics, native
Canvas history, and an expandable Spot/Perp comparison. Back returns to the list.
Filter the watchlist by symbol, name or category; cycle Sort to compare movement
without changing the saved order. Manage searches the local catalog and Yahoo
stocks/ETFs; arrows and Enter add results, and removed rows have Undo. Each row’s
Edit actions provide move, pin and remove controls; Alt+Up/Down reorders from Edit.
Up to 20 instruments are supported; existing watchlists migrate in place.

Headlines and history share one explicit instrument: Binance **USDT spot**,
Yahoo equities in their **reported currency**, or Hyperliquid **HYPE USDC perpetual**.
USD and USDT are distinguished; sources are never averaged or silently replaced
with perpetual prices. HYPE's headline is mark price; its candle closes are trades.
Missing data appears as `—`. Equity volume is shares, not dollars.

Connection state, quote age and session status are separate. Last-known values
stay visible with age and freshness when a feed fails. History has loading,
unavailable, stale-cache and retry states. Choose `1D / 1W / 1M / 1Y`; actual
dates, interval and source appear beneath the chart. Equity 1D shows the latest
regular session across closures; crypto 1D is 24 hours. Longer ranges use
calendar windows.
See [exact semantics](docs/SEMANTICS.md).

## Requirements

- Omarchy Quattro, Quickshell **0.3+**, Qt **6.8+**.
- Node.js **22.4+** (24/26 also supported).
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

### Upgrading to 1.4.2

```bash
omarchy plugin update io.github.dpr.omarchy-market --yes
omarchy restart shell
```

Your watchlist, order, fixed ticker, rotation preference and existing widget
settings are preserved. Restarting the shell loads the updated QML code.
This update includes bounded WebSocket messages, fresh HTTP recovery and streamed
response limits, together
with the native charts and date-window statistics introduced in 1.4.0. See the
[1.4.2 changelog](CHANGELOG.md#142--2026-10-22) for the release details.

Remove with `omarchy plugin remove io.github.dpr.omarchy-market`.

## Controls and settings

- Bar left-click: chart for the displayed instrument. Back opens the watchlist. Middle-click: refresh quotes and any visible
  history. Right-click: cycle and pin a bar instrument.
- **Manage → Bar ticker**: choose a stable asset. Rotation is off by default and
  can be enabled in Manage. The chart emphasizes the ticker and price, with a smaller
  currency label. The bar fits its text, and hovering keeps neighboring indicator reveals from
  shifting it. Crypto bar prices omit quote codes; tooltip and detail preserve them.
- **Tab / Shift+Tab**: move between controls and rows. **Enter / Space** activates.
- **Escape**: Back from detail/Manage, then close. **R** refreshes outside search;
  **/** opens Manage and focuses search. Search supports Up/Down and Enter.
- Hover or focus the chart and use Left/Right, Home/End for actual candle time
  and price. Chart times use your local timezone; equity spacing omits closed
  periods. The selected window has its own change and high/low/average close
  overview. Expand the latest-session/24-hour snapshot for current daily volume.

Stale or missing quotes trigger automatic recovery, with attempts limited to
once per provider every 15 seconds. Refresh replaces outstanding quote requests
and reconnects streams, with a 30-second reconnect cooldown. The button shows
“Refreshing…” while requests are pending. Provider outages can still delay new data;
the last received values stay labelled stale until an update succeeds.
HTTP requests own fresh connections, so a broken connection in the shared
shell cannot trap market retries. Search responses stop at 128 KiB; quote and
history responses stop at 1 MiB, including chunked responses without a length.

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
node tests/run_native.js      # real HTTP, streamed byte limits, settings restart, cleanup
node tests/run_http_recovery.js # native HTTP/2 outage/startup recovery (Qt dev tools, c++, openssl)
node tests/run_security.js    # hostile remote text; zero rich-text resource loads
node tests/run_ws_native.js   # real WebSocket helper, byte budgets and native IPC cleanup
node tests/run_ui.js          # real Wayland popup, pointer and keyboard checks
node tests/run_ui.js ticker   # compact bar, hover, direct asset chart and rotation
node tests/run_ui.js chart    # session axis, curve geometry and inspection
node tests/run_ui.js window   # timeframe stats and stale/missing/single states
node tests/capture_ui.js      # native fixture screenshots; no live requests
node tests/capture_gallery.js # settled live gallery; identical window sizes
node tests/run_ui.js equity   # optional live Yahoo session-chart regression
./scripts/live-test.sh        # optional external WebSocket connectivity
```

Native tests use temporary settings and leave the installed shell intact.
See [testing and limitations](docs/TESTING.md). Node tests alone do not establish
that the native UI works.

## License and acknowledgments

Omarchy Market is [MIT licensed](LICENSE). The native chart adapts the Steffen
curve helper from TradingView Lightweight Charts under Apache-2.0; its
[license, notice and source attribution](third_party/lightweight-charts/README.md)
are included. The bundled [ws client and MIT license](third_party/ws/README.md)
provide bounded WebSocket reception. No TradingView service or embedded charting website is required.

Changes reach the protected `master` branch through checked pull requests.
See [maintainer workflow](docs/MAINTAINING.md).
