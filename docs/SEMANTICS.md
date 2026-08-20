# Financial Data & Market Semantic Specification

This document provides the financial and mathematical specification of every metric displayed by **Omarchy Market**.

---

## 1. Asset & Instrument Taxonomy

The plugin tracks 4 core cryptocurrencies across spot and derivative markets without combining incompatible instruments.

| Asset Key | Asset Name | Target Instrument | Default Price Type | Provider Feeds |
|---|---|---|---|---|
| `BTC` | Bitcoin | `BTC_USD_SPOT` | `SPOT_LAST` / `SPOT_MID` | Binance (`BTCUSDT`), Coinbase (`BTC-USD`), Hyperliquid (`BTC` perp) |
| `ETH` | Ethereum | `ETH_USD_SPOT` | `SPOT_LAST` / `SPOT_MID` | Binance (`ETHUSDT`), Coinbase (`ETH-USD`), Hyperliquid (`ETH` perp) |
| `SOL` | Solana | `SOL_USD_SPOT` | `SPOT_LAST` / `SPOT_MID` | Binance (`SOLUSDT`), Coinbase (`SOL-USD`), Hyperliquid (`SOL` perp) |
| `HYPE` | Hyperliquid Token | `HYPE_USD_PERP` | `PERP_MID` / `PERP_MARK` | Hyperliquid DEX native (`HYPE`) |

---

## 2. Metric Definitions & Formulas

### A. Live Price (`price`)
- **Spot Markets (Binance & Coinbase)**: The most recent matched trade execution price (`SPOT_LAST`) in USD or USDT equivalent.
- **Perpetual Markets (Hyperliquid)**: The real-time order-book midpoint price:
  $$\text{Mid Price} = \frac{\text{Best Bid} + \text{Best Ask}}{2}$$
- **Reference Spot Price (Bar / Default Panel Header for BTC, ETH, SOL)**:
  Arithmetic average across all currently active (`LIVE`) spot feeds (Binance + Coinbase). Stale or offline feeds are automatically excluded.
  $$\text{Reference Price} = \frac{1}{N} \sum_{i \in \text{Live Spot Feeds}} P_i$$
- **HYPE Reference Price**: Because HYPE is native to Hyperliquid, its reference price routes directly to the Hyperliquid DEX feed without artificial averaging.

### B. 24-Hour Percentage Change (`change24h`)
- Represents the relative price difference compared to the rolling 24-hour baseline:
  $$\text{Change \%} = \frac{\text{Current Price} - \text{Price}_{t - 24\text{h}}}{\text{Price}_{t - 24\text{h}}} \times 100$$
- Displays a leading `▲` (green/teal `#26a69a`) when $\ge 0\%$ and `▼` (red `#ef5350`) when $< 0\%$.

### C. 24-Hour High & Low (`high24h`, `low24h`)
- Rolling maximum and minimum trade execution prices recorded by the underlying exchange over the past 24 hours.
- Reference view takes $\max(\text{High}_{\text{spot}})$ and $\min(\text{Low}_{\text{spot}})$.

### D. 24-Hour Volume (`volume24h`)
- Normalized 24-hour notional turnover in US Dollars ($USD$).
- Compact notation: `$1.27B` ($10^9$), `$45.00M` ($10^6$), `$750.0K` ($10^3$).

---

## 3. Freshness & Stale Data State Machine

Every incoming price payload is stamped with both `providerTimestamp` (exchange clock) and `receivedTimestamp` (local clock $T_{\text{local}}$).

```
   (Traffic < 15s)            (15s <= Traffic < 60s)             (Traffic >= 60s)
+---------------------+     +-----------------------+     +---------------------+
|        LIVE         | --> |         STALE         | --> |       OFFLINE       |
|  Green Badge/Teal   |     |   Yellow Badge/Dim    |     |   Red Badge/Muted   |
+---------------------+     +-----------------------+     +---------------------+
           ^                            ^                            |
           |                            |                            |
           +----------------------------+----------------------------+
                           (New WebSocket message received)
```

- **`LIVE`**: $\Delta t < 15,000\text{ ms}$. Data is actively streaming.
- **`STALE`**: $15,000\text{ ms} \le \Delta t < 60,000\text{ ms}$. WebSocket traffic delayed; REST fallback snapshot is triggered.
- **`OFFLINE`**: $\Delta t \ge 60,000\text{ ms}$. Feed disconnected; UI clearly marks state as `OFFLINE`.
