# Architecture & Technical Decisions

### ADR 001: WebSocket Transport Proof & Zero-Daemon Subprocess Bridge
- **Context**: The desktop shell requires true bidirectional WebSocket connectivity (RFC 6455 TLS handshake, client masking, subscription messages, ping/pong heartbeats). Curl CLI cannot perform client-side RFC 6455 frame masking or handle subscription frames. `qt6-websockets` is missing in the system Qt6 distribution.
- **Investigation**: We tested live WebSocket connections against Binance, Coinbase, and Hyperliquid. Node v26 is already installed in the environment and includes the WHATWG standard `WebSocket` built-in globally with zero dependencies/npm packages.
- **Decision**: Implement a lightweight, single-file stdio line bridge `scripts/ws_bridge.js` launched directly by Quickshell's native `Quickshell.Io.Process`. The child process lifecycle is strictly bound to the QML `Process` item (auto-terminated on destruction).
- **Consequences**:
  - Full RFC 6455 compliance with TLS, JSON subscriptions, and automated ping/pong.
  - Zero background daemon, zero systemd service, zero system package installation, zero sudo, zero external packages.
  - Paired with native QML `XMLHttpRequest` for REST snapshots, historical candles, and graceful fallback.

### ADR 002: Distinct Instrument & Price Type Modeling
- **Context**: Binance and Coinbase trade spot markets (`BTC/USDT`, `BTC/USD`), while Hyperliquid trades perpetual futures and native DEX markets (`HYPE`, `BTC-PERP`). Naively averaging spot and perp quotes into a "global price" produces misleading financial data.
- **Decision**: The internal model explicitly distinguishes:
  - `Asset`: Underlying asset key (`BTC`, `ETH`, `SOL`, `HYPE`).
  - `Instrument`: Specific market instrument (e.g. `BTC_USD_SPOT`, `BTC_USD_PERP`, `HYPE_USD_PERP`).
  - `PriceType`: `SPOT_LAST`, `SPOT_BID`, `SPOT_ASK`, `PERP_MID`, `PERP_MARK`.
- **Consequences**: Accurate pricing with clear presentation in the UI. Spot and perp markets are never mixed without explicit context.

### ADR 003: Controlled REST Request Scheduler with Deduplication & Rate Limiting
- **Context**: Uncontrolled fallback during network instability can result in rapid request loops.
- **Decision**: All REST requests for snapshots and candles pass through a request scheduler with minimum request intervals, in-flight deduplication, and exponential backoff on HTTP 429/5xx.
- **Consequences**: Guaranteed $0 operating cost, zero rate-limit bans, and clean recovery.

### ADR 004: Genuine Third-Party Omarchy Quattro Plugin
- **Context**: The plugin must integrate smoothly into Omarchy without altering system files or packaged source.
- **Decision**: Implement the plugin entirely inside `~/.config/omarchy/plugins/io.github.dpr.omarchy-market` conforming to Quattro's `manifest.json` schemaVersion 1 contract (`kinds: ["service", "bar-widget"]`).
- **Consequences**: Plug-and-play installation, zero core modifications, clean hot-reload support via `inotifywait`.
