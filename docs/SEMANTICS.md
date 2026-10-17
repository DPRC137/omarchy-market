# Market data semantics

The default price is one selected instrument, used for both the headline and
history. The legacy `aggregate` API name remains an alias for that selection:

| Asset | Source | Instrument | Quote unit | Headline price |
| --- | --- | --- | --- | --- |
| Crypto except HYPE | Binance | `ASSETUSDT` Spot | USDT | Last trade |
| HYPE | Hyperliquid | HYPE Perp | USD | Mark |
| Equities / ETFs | Yahoo | Exact Yahoo symbol | Metadata currency, case preserved | Regular-session last |

USD and USDT are distinct. There is no price averaging, currency conversion,
provider failover, or Spot-to-Perp substitution. Comparison rows are independent
and labelled Spot / Perp / Equity. Hyperliquid candle closes are **trade prices**;
the HYPE headline is explicitly **mark price**, not an execution price.

Yahoo search often omits currency. Such entries can be saved with unknown
currency; price display waits for valid chart metadata. Three-letter reported
units are preserved, including `GBp` and `ZAc` (scaled units, not GBP/ZAR).
Missing or unrecognized currency makes the quote unavailable. Dynamic symbols
are limited to 24 letters/digits/dots/hyphens. Existing international entries
previously labelled USD migrate with currency unknown until verified.

Missing prices and metrics are null and displayed as `—`. Zero is meaningful
for volume and percentage change. Volume is Binance quote turnover in USDT,
Coinbase base volume in the asset, Hyperliquid notional in USD, or equity shares.
Unavailable Hyperliquid high/low are never inferred from the current price.

Crypto changes/high/low/volume cover rolling 24 hours. Equity metrics describe
the regular session and change versus previous regular close, including during
pre/post-market. Session status is separately derived from Yahoo's supplied
trading periods. No local holiday or exchange-hours guesses are used.

## Independent status dimensions

- **Connection**: WebSocket transport state for Binance/Coinbase; last HTTP
  outcome for Yahoo/Hyperliquid. A REST quote does not turn a WebSocket green.
- **Quote age**: Provider event time (or HTTP acquisition time when the provider
  gives no event timestamp) shown separately from local receipt age.
- **Freshness**: Recomputed every second. Crypto becomes STALE after 15 seconds
  without an accepted quote; Yahoo is CURRENT for up to 120 seconds while open
  or 660 seconds when closed, accommodating polling of up to 20 watched symbols.
  Older values remain visible as STALE. Missing prices are UNAVAILABLE.
- **Session**: regular, preMarket, postMarket, closed, or unknown. Closed does
  not mean disconnected. A CURRENT closed quote can still have an old trade time.

## Chart ranges and cache

Labels are calendar ranges ending at request time, independent of asset:

| Range | Calendar span | Binance / Hyperliquid interval | Yahoo interval |
| --- | --- | --- | --- |
| 1D | 24 hours | 5 minutes | 5 minutes |
| 1W | 7 days | 1 hour | 30 minutes |
| 1M | 30 days | 4 hours | 1 hour |
| 1Y | 365 days | 1 day | 1 day |

The actual first/last candle times, local timezone, interval and source appear
below the chart. Equity candles exclude extended hours. An equity range during
closure may contain fewer than two points and explicitly show unavailable;
no prices are manufactured to fill weekends or gaps. Chart colour follows
first-to-last movement in the selected range, independently of headline change.

Cache entries include source, currency, interval and fetch time. They expire
after 60 seconds; at most 32 datasets of at most 1000 points each are retained.
Only an open detail view requests history. Changing view invalidates the old
generation before cancelling work. The visible chart refreshes every minute;
Refresh requests both quotes and visible history. Failures preserve existing
history as stale cache with a retry action. Retry uses the same instrument.
