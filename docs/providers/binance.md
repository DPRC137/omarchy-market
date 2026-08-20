# Binance Public Market Data Provider

## Overview
Binance provides public real-time ticker and kline feeds without requiring authentication or API keys.

## Protocols & Endpoints

### 1. WebSocket Combined Stream
- **URL**: `wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/solusdt@ticker`
- **Stream Format**: `<symbol>@ticker` (all lowercase, e.g. `btcusdt@ticker`)
- **Protocol**: Raw WebSocket stream. No initial subscribe frame is required when using the `/stream?streams=...` URL.

### 2. Message Payload (24hr Ticker)
```json
{
  "stream": "btcusdt@ticker",
  "data": {
    "e": "24hrTicker",
    "E": 1787262066018,
    "s": "BTCUSDT",
    "p": "3296.00000000",
    "P": "4.742",
    "w": "71149.17130709",
    "x": "69509.99000000",
    "c": "72806.00000000",
    "Q": "0.01144000",
    "b": "72805.99000000",
    "B": "1.48431000",
    "a": "72806.00000000",
    "A": "0.48540000",
    "o": "69510.00000000",
    "h": "73110.70000000",
    "l": "68902.22000000",
    "v": "37081.96338000",
    "q": "2638350964.92693750",
    "O": 1787175666003,
    "C": 1787262066003,
    "F": 6583771802,
    "L": 6590187442,
    "n": 6415641
  }
}
```

### 3. Normalization Mapping
| Normalized Field | Binance Field | Description |
|---|---|---|
| `price` | `data.c` | Last trade price |
| `change24h` | `data.P` | 24-hour price change percentage |
| `high24h` | `data.h` | 24-hour high price |
| `low24h` | `data.l` | 24-hour low price |
| `volume24h` | `data.q` | 24-hour quote asset volume (USDT) |
| `bid` | `data.b` | Best bid price |
| `ask` | `data.a` | Best ask price |
| `providerTimestamp` | `data.E` | Event timestamp (milliseconds) |

### 4. REST Klines / Candles
- **URL**: `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24`
- **Output format**: Array of `[openTime, open, high, low, close, volume, closeTime, quoteVolume, count, ...]`
