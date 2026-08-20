# Coinbase Exchange Market Data Provider

## Overview
Coinbase provides public real-time ticker and candlestick market data over public WebSocket channels and REST APIs without authentication via the Coinbase Exchange Market Data API (`exchange.coinbase.com`).

## Protocols & Endpoints

### 1. WebSocket Feed
- **URL**: `wss://ws-feed.exchange.coinbase.com`
- **Channel**: `ticker`
- **Subscribe Frame**:
  ```json
  {
    "type": "subscribe",
    "product_ids": ["BTC-USD", "ETH-USD", "SOL-USD"],
    "channels": ["ticker"]
  }
  ```

### 2. Message Payload (Ticker)
```json
{
  "type": "ticker",
  "sequence": 12345678,
  "product_id": "BTC-USD",
  "price": "72794.99",
  "open_24h": "69470.00",
  "volume_24h": "16632.60752767",
  "low_24h": "68900.00",
  "high_24h": "73100.00",
  "volume_30d": "178538.39",
  "best_bid": "72794.99",
  "best_ask": "72795.00",
  "side": "buy",
  "time": "2026-08-20T21:41:11.150012718Z",
  "trade_id": 1074528763,
  "last_size": "0.00000013"
}
```

### 3. Normalization Mapping
| Normalized Field | Coinbase Field | Description |
|---|---|---|
| `price` | `price` | Last trade execution price |
| `change24h` | `((price - open_24h) / open_24h) * 100` | Computed rolling 24h percentage |
| `high24h` | `high_24h` | 24-hour high price |
| `low24h` | `low_24h` | 24-hour low price |
| `volume24h` | `volume_24h * price` | Computed notional USD turnover |
| `bid` | `best_bid` | Best bid |
| `ask` | `best_ask` | Best ask |
| `providerTimestamp` | `Date.parse(time)` | ISO timestamp parsed to ms |

### 4. REST Endpoints
- **Snapshot Ticker**: `https://api.exchange.coinbase.com/products/{product_id}/ticker`
- **24h Stats**: `https://api.exchange.coinbase.com/products/{product_id}/stats`
- **Candles (Klines)**: `https://api.exchange.coinbase.com/products/{product_id}/candles?granularity={seconds}`
