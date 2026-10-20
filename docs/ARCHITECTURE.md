# Native architecture

Quattro mounts `MarketService.qml` and `BarWidget.qml`. The bar loads the native
`Panel.qml` using Quattro's KeyboardPanel/BorderSurface and shared theme tokens.
There is no browser UI, external backend, framework replacement or npm package.

- `models/MarketModel.js`: catalog, schema-v2 migration, ordered watchlist
  operations, provider normalization, source selection, units, freshness and
  formatting. QML reads the same functions exercised by portable Node tests.
- `MarketService.qml`: provider lifetime, bounded watched quote store (20 assets
  × supported providers), one-second UI freshness revision, persisted settings,
  undo, pinned asset and optional rotation, visible history lifecycle.
- `models/Recovery.js`: checks each watched provider/instrument for stale or
  missing quotes on the service's one-second clock. Recovery fetches are limited
  to once per feed every 15 seconds; normal HTTP deduplication/backoff still
  applies. Closed-market equities retain their longer freshness window.
- `models/History.js`: provider request specifications, calendar range/interval
  separation, generation and identity validation, provider-defined equity day sessions, one
  bounded empty-session recovery, candle filtering, bounded
  expiring cache, loading/ready/stale/unavailable states.
- `models/RequestQueue.js`: shared production HTTP scheduler: one active request
  per provider, at most 24 waiting jobs, key deduplication, priority, cancellation,
  eight-second deadlines, at most two retries with 4s/8s backoff for transient
  HTTP/network/deadline failures. A visible chart can displace a background job;
  displaced/rejected work is notified. Response callbacks are finalized once.
- `providers/HttpClient.qml`: actual QML XHR adapter and explicit Qt Timer polling
  scheduler deadlines. Enforces response-size ceilings before parsing. Queues
  are destroyed with their owners and all active XHRs are aborted.
- Named Binance/Coinbase/Hyperliquid providers use `CryptoProvider.qml` for shared
  subscription/HTTP/process lifetime. Only watched provider-supported symbols
  are subscribed. Binance/Coinbase each own one stdio WebSocket bridge;
  Hyperliquid polls mark/context data every eight seconds, requiring no bridge.
  Background quote REST refreshes are deduplicated. Manual Refresh replaces
  outstanding quote work and repairs streams (at most once every 30 seconds),
  preserving search/history jobs. Removed/unwatched responses are ignored.
- `YahooProvider.qml`: one queue shared by quotes, search and history, with
  1200ms minimum spacing. Polls every minute if any watched stock is open or
  unknown, otherwise every five minutes. Search remains on-demand even without
  watched equities. Stale search replies are ignored and failures are explicit.
- `scripts/ws_bridge.js`: native Node WebSocket, subscription deltas, reconnect
  watchdog/backoff, ten-second connection deadline and explicit reconnect IPC.
  The watchdog schedules recovery directly without waiting for a close event.
  Empty subscriptions open no socket. Old sockets and timers
  are closed on reconnect. Parent EOF and SIGTERM clean up the process.

History jobs have higher priority than search, followed by background quotes.
Changing instrument/range, leaving detail, or closing the popup cancels queued
and active history without scheduling background chart downloads. The generation
is invalidated **before** abort because QML abort emits readyState synchronously.
Only matching provider/asset/instrument/interval/request generation may cache a
response. Hyperliquid payload instrument/interval and Yahoo payload symbol and
currency are checked too; Binance kline arrays carry no symbol/interval, so their
identity comes from the request's isolated URL/closure, never mutable globals.

Settings retain the original QSettings category and host organization/application
file location, with explicit default names when the host omits them. Initial
loading is deferred until Quickshell has established its application identity.
Schema v1 and legacy arrays preserve asset ordering. If the scoped category is
empty, migration also reads the legacy General-group watchlist produced by hosts
without application identifiers; the original value is kept intact. Version 2 additionally
persists dynamic currency and exchange metadata. Unrelated shell.json values
(`multiAsset`, `speed`) retain their meaning; pin/rotation are separate settings.

## Runtime assumptions and provider references

Require Node **22+** with native WebSocket enabled (stable since 22.4); Node 20
requires a flag and is no longer advertised as working out of the box. The bridge
fails clearly if WebSocket is absent. Quickshell 0.3+ / Qt 6.8+ remain the native
baseline; desktop testing here used Quickshell 0.3.1.

Verified provider/API assumptions against:

- [Qt QML XHR](https://doc.qt.io/qt-6/qml-qtqml-xmlhttprequest.html): partial XHR
  Level 1, with abort and readyState callbacks. Browser timeout/onerror APIs are
  deliberately not used; Qt timers enforce deadlines.
- [Node WebSocket](https://nodejs.org/api/globals.html#class-websocket).
- [Binance market endpoints](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market): explicit kline interval and time bounds;
  REST tickers and WebSocket tickers use different field spellings.
- [Hyperliquid contract units](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/contract-specifications): USDC-priced HYPE versus USDT-priced other supported crypto perps, all USDC collateral.
- [Hyperliquid info](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint): candleSnapshot request/response identity, mark versus mid.
- [Coinbase candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles): no unsupported 4h/weekly requests are issued;
  Coinbase is a comparison feed, not the selected history source.

Yahoo endpoints are unofficial and may fail or change. No availability guarantee
is implied by deterministic tests. See TESTING.md for desktop versus portable
verification boundaries.

## Native view boundaries (unreleased redesign)

`Panel.qml` owns navigation, debounced discovery, mutations and the visible-chart
lifecycle. Its fixed header reflows independently of a single content scroller;
focus changes scroll the active control into view. Deferred focus restoration
checks the current view before running.

- `ui/MarketTokens.qml` derives colors from the active popup palette and adjusts
  secondary text/accent contrast toward its foreground.
- `ui/WatchlistView.qml` and `models/WatchlistView.js` create an immutable local
  filter/sort projection. They fetch no history and never persist view ordering.
- `ui/AssetDetail.qml` renders one explicit source quote and history entry. Chart
  inspection uses separate scene-graph items; unchanged candle content does not
  trigger a Canvas redraw. Equity observations use logical bar spacing, while the curve joins only actual
  observations and hover retains their source timestamps.
- `ui/ManageView.qml` presents discovery and contextual actions. Removal finishes
  focus recovery in the parent component because the row is destroyed when the
  ordered watchlist changes.

Provider scheduling, service lifetime, persistence schema/category, the
20-instrument limit and the bar widget remain as on the master baseline.

`models/HistoryStats.js` computes selected-window close statistics without changing
cached data or fetching anything. `ui/WindowSummary.qml` renders them independently
of the headline's daily quote. `models/ChartGeometry.js` adapts the Steffen curve
kernel from TradingView Lightweight Charts and supplies the padded price scale;
its source/license/changes are recorded under `third_party/lightweight-charts/`.
