# Screenshot provenance

## Chart-window follow-up

`chart-windows/*.png` captures the actual native card on 2026-10-21
(Asia/Kolkata), including the theme background and border:

- `aapl-month`: live Yahoo AAPL 1M history with 155 hourly closes, captured by
  `MARKET_EQUITY_ASSET=AAPL MARKET_EQUITY_RANGE=1M` using the equity harness.
  Quote, percentage and freshness are observations at capture time.
- `equity-closed`: normalized saved Yahoo TSLA regular-session payload with
  79 closes, rendered by `tests/capture_ui.js` in an isolated host.
- `narrow-summary`: the same fixture at 300px width and enlarged text, scrolled
  to show the complete selected-window overview and daily snapshot disclosure.

These were inspected for price/time axes, continuous curve geometry, summary
alignment, wrapping and clipping. See [chart-window validation](../CHART_WINDOWS.md).
No user preferences or installed watchlist were changed by capture hosts.

## Unreleased native redesign

`redesign/*.png` captures the actual Quickshell popup card, including Quattro’s
background and border, on 2026-10-21 (Asia/Kolkata). Produced with
`node tests/capture_ui.js` in a temporary host/config directory. They use the
saved Binance BTC ticker and Yahoo TSLA 2026-10-16 regular-session payloads,
normalized by the production models. BTC is explicitly stale; ETH/HYPE have
unavailable quotes. These examples are not live market observations.

- `watchlist`, `detail`, `equity-closed`, `manage`, `search`: primary screens.
- `empty`, `loading`, `error`, `single`: deterministic state examples.
- `narrow-manage`, `narrow-detail`: 300px card width and 18px base font;
  remaining content is scrollable and the navigation wraps without overlap.
- `live-equity`: optional live Yahoo check, showing 68 candles for the
  2026-10-20 regular session. This is a content-only grab; it excludes card
  background/border and the portion below the viewport.

The screenshots were inspected for clipping, alignment, readable source/session
labels, chart axes, state copy and navigation overflow in the active dark theme. See
[validation notes](../NATIVE_REDESIGN.md) for the precise scope and limitations.

## Historical 1.3.0 gallery

The `v1.3.0-*.png` images show the actual native Omarchy Market 1.3.0 popup,
rendered on Wayland with installed Quattro imports on 2026-10-18 (Asia/Kolkata).
Each captures the popup card, including its native theme, background and border;
no surrounding desktop or account information is included.

- `v1.3.0-crypto.png`: live Binance BTC/USDT spot quote and 288 real 5-minute candles.
- `v1.3.0-equity.png`: live Yahoo TSLA quote and 79 regular-session candles for
  2026-10-16, shown while closed with the session date explicitly labelled.
- `v1.3.0-watchlist.png`: live BTC, ETH, TSLA and AAPL quotes in a compact list.
- `v1.3.0-manage.png`: the final fixed-ticker selector, optional rotation, search
  and ordering controls for the same example watchlist.

The capture host used temporary settings and a four-instrument example watchlist;
it did not change the installed watchlist or preferences. Prices, freshness ages,
provider status and dates are observations at capture time, not price expectations
or guarantees of ongoing provider availability.

The root `preview.png` is an identical copy of `v1.3.0-crypto.png` for marketplace
preview discovery.

Older `before-*` / `after-*` images are historical evidence from the implementation
and remain linked from the earlier verification notes. The README uses the final
1.3.0 captures above.
