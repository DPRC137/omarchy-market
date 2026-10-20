# Changelog

## 1.4.0 — 2026-10-21

### A new native interface

- Follow crypto, stocks and ETFs in a compact watchlist with symbol/name filtering,
  category tabs and view-only sorting. Sorting leaves your saved order intact.
- Open an instrument directly from the bar. Price, currency, movement, source and
  freshness lead the detail view; navigation remains available while scrolling.
- Find and add instruments in Manage, then edit, reorder, remove or pin them with
  contextual actions. Undo restores removals. Bar rotation stays optional.
- Use the active dark Omarchy theme, responsive layouts and keyboard controls,
  including enlarged-text and narrow-window support.
- Keep date-window buttons and statistic columns aligned when font-scaled
  spacing rounds to whole pixels.

### Charts and statistics for the selected window

- Join equity observations continuously with logical trading-session spacing,
  removing empty overnight/weekend stretches and disconnected daily fragments.
- Adapt TradingView Lightweight Charts' Steffen curve geometry for the native
  renderer, with its Apache-2.0 license and notice retained. Curves pass through
  observed closes without adding extrema; no browser component is required.
- Read a padded, labelled price scale and inspect exact source prices/timestamps
  with the crosshair or Left/Right and Home/End keys.
- Show each 1D/1W/1M/1Y window's absolute and percentage price change,
  high/low/average observed close, actual date coverage and sample count.
  Keep the daily headline comparison separate, with daily/session metrics in
  an expandable snapshot. Missing, single, flat and cached windows are explicit.

### Gallery and compatibility

- Replace the old marketplace preview with an explanatory promotional image based
  on the current UI. Publish seven fresh live captures covering charts, watchlist,
  Manage/search and contextual editing, all at the same window size and taken
  after loading and refresh activity finishes.
- Preserve existing watchlists, order, pinned ticker, rotation and widget settings.
  Include the automatic stale-feed recovery improvements from 1.3.1 for users
  upgrading from the marketplace's previous 1.3.0 snapshot.
- Verified with portable CI on Node 22/24/26, Qt QML lint, native UI/chart/ticker,
  selected-window and HTTP/settings checks, plus live equity/crypto captures.
  Screen readers, exhaustive multi-monitor scaling and long-duration soak remain
  untested. See [verification](docs/TESTING.md) and the
  [1.4.0 gallery](docs/screenshots/v1.4.0/README.md).

## 1.3.1 — 2026-10-21

- Recover stale or missing quotes automatically, with attempts throttled to
  once per provider every 15 seconds while preserving closed-market freshness.
- Make Refresh replace blocked quote requests and repair streaming connections,
  with a 30-second reconnect cooldown and visible request progress.
- Time out WebSocket connections that never open and reconnect silent sockets
  without waiting for a close event. Preserve watchlists and existing settings.
- Add deterministic recovery/bridge regressions and native QML refresh checks.

## 1.3.0 — 2026-10-18

- Preserve quote currencies and instrument types, show time-based freshness,
  and distinguish connection status from market sessions.
- Serialize provider requests with bounded retries, cancellation and expiring
  history caches. Equity 1D retains the latest regular session while closed.
- Open the displayed ticker chart directly, keep hover sizing stable, and make
  the ticker prominent with a smaller currency label. Choose the fixed bar
  ticker and optional rotation in Manage.
- Add a compact watchlist, keyboard search, ordered Undo and settings migration
  that preserves existing watchlists and bar preferences.
- Add production-module regressions, isolated native integration checks and
  portable CI on Node 22, 24 and 26.

Existing installations retain their watchlist and order. Quote sources and units
are explicit: Binance USDT spot, Yahoo equities in reported currency, and HYPE
USDC perpetual mark price. See [semantics](docs/SEMANTICS.md) for details and
[verification](docs/TESTING.md) for evidence and remaining limits.
