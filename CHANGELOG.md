# Changelog

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
