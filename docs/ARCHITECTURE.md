# Omarchy Market Architecture

```
                      omarchy-shell (Quickshell Host)
                                    │
                         ┌──────────┴──────────┐
                         │  MarketService.qml  │ (kind: "service")
                         └──────────┬──────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                ▼                   ▼                   ▼
         BinanceProvider     CoinbaseProvider    HyperliquidProvider
         (WebSocket/REST)    (WebSocket/REST)     (WebSocket/REST)
                │                   │                   │
                └───────────────────┼───────────────────┘
                                    ▼
                         Normalizer (MarketModel.js)
                                    │
                                    ▼
                         Quote Store & Candles
                                    │
                                    ▼
                         Aggregator (Reference Price)
                                    │
                ┌───────────────────┴───────────────────┐
                ▼                                       ▼
          BarWidget.qml                             Panel.qml
      (Scrolling Mini Ticker)                (Compact Market Terminal)
```

## Data Flow
1. **Providers**: Individual provider modules (`BinanceProvider`, `CoinbaseProvider`, `HyperliquidProvider`) establish connections and stream raw trade/ticker payloads.
2. **Normalization**: `MarketModel.js` converts raw payloads into standard `MarketQuote` objects with `price`, `change24h`, `high24h`, `low24h`, `volume24h`, `bid`, `ask`, and timestamps.
3. **Quote Store**: `MarketService` indexes quotes by `[asset][provider]` and computes reference aggregate quotes (volume-weighted or median).
4. **Presentation**:
   - `BarWidget`: Displays compact tickers (e.g. `BTC $72.8K ▲4.8% · ETH $2.32K ▲1.8% · SOL $87.6 ▲1.2% · HYPE $74.6 ▲2.7%`), supports ticker cycling, pause on hover, and toggling the panel.
   - `Panel`: Displays the rich asset terminal with 24h metrics, exchange price comparison, provider health badges, and native Canvas sparkline charts.
