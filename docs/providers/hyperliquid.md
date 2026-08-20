# Hyperliquid Public Market Data Provider

## Overview
Hyperliquid is a high-performance L1 DEX. It is the primary native trading venue for `HYPE` as well as major crypto perps (`BTC`, `ETH`, `SOL`). All market data is public without API keys.

## Protocols & Endpoints

### 1. REST Meta & Market Contexts
- **URL**: `POST https://api.hyperliquid.xyz/info`
- **Payload**: `{"type": "metaAndAssetCtxs"}`
- **Response**: Array with `[ { universe: [...] }, [ { assetCtx }, ... ] ]`

### 2. Context Object Fields
```json
{
  "name": "HYPE",
  "markPx": "74.628",
  "prevDayPx": "72.69",
  "dayNtlVlm": "1273288450.96",
  "midPx": "74.6455",
  "impactPxs": ["74.6427", "74.6521"],
  "oraclePx": "74.5745",
  "dayBaseVlm": "17730997.79",
  "funding": "0.000015669",
  "openInterest": "23251432.30"
}
```

### 3. Normalization Mapping
| Normalized Field | Hyperliquid Field | Description |
|---|---|---|
| `price` | `markPx` or `midPx` | Mark / Mid price |
| `change24h` | `((markPx - prevDayPx) / prevDayPx) * 100` | 24h change % |
| `high24h` | Estimated from candle / markPx | High mark |
| `low24h` | Estimated from candle / markPx | Low mark |
| `volume24h` | `dayNtlVlm` | 24-hour notional USD volume |
| `bid` | `impactPxs[0]` | Top bid price |
| `ask` | `impactPxs[1]` | Top ask price |
| `providerTimestamp` | Current response time | Server event time |

### 4. REST Candles
- **URL**: `POST https://api.hyperliquid.xyz/info`
- **Payload**: `{"type": "candleSnapshot", "req": {"coin": "HYPE", "interval": "1h", "startTime": <startTimeMs>}}`
- **Output format**: Array of `[ { t, T, s, i, o, c, h, l, v, n }, ... ]`
