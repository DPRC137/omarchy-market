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
- `models/History.js`: provider request specifications, calendar range/interval
  separation, generation and identity validation, candle filtering, bounded
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
  Quote REST refreshes are deduplicated. Removed/unwatched responses are ignored.
- `YahooProvider.qml`: one queue shared by quotes, search and history, with
  1200ms minimum spacing. Polls every minute if any watched stock is open or
  unknown, otherwise every five minutes. Search remains on-demand even without
  watched equities. Stale search replies are ignored and failures are explicit.
- `scripts/ws_bridge.js`: native Node WebSocket, subscription deltas, reconnect
  watchdog/backoff. Empty subscriptions open no socket. Old sockets and timers
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
