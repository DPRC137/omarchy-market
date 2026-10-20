# Chart window follow-up

The reported 1M equity chart used wall-clock spacing and broke at every market
closure. Joining those segments alone left long connectors and tight intraday
clusters. The final chart uses logical observation spacing for equities, matching
[TradingView's documented logical time scale](https://tradingview.github.io/lightweight-charts/docs/time-scale).
It adapts the [open-source Steffen curve renderer](https://github.com/tradingview/lightweight-charts/blob/82e14e72776fa8b91ab94de0eaac9ab4b0c6c1cd/src/renderers/walk-line.ts), with its Apache-2.0 license and notice retained.

The curve passes through recorded closes and adds no extrema. Date labels and
hover inspection use real source timestamps. A padded linear price axis has
readable numeric ticks; crosshair inspection snaps to actual observations.
This is a native renderer adaptation, not an embedded TradingView website.

The selected 1D/1W/1M/1Y overview shows absolute/percentage close-to-close change,
high/low/average close, observed coverage and sample count. Daily headline change
remains distinct, and the daily/session snapshot is expandable. Empty, single,
flat, loading and stale windows are explicit. Currency/source semantics are
unchanged; window volume is not fabricated from the daily quote.

Validation on 2026-10-21 (Asia/Kolkata): portable production-module tests, filtered
QML lint, native chart/window/UI/ticker checks and native HTTP/settings/cleanup
all pass. Live AAPL 1W/1M/1Y history and the corresponding summaries were rendered
and inspected; the final monthly chart includes 155 actual hourly closes.
Native fixture captures cover loading/error/single observations and 300px width
with enlarged text, including a scrolled view of the complete summary.

[Final screenshots](screenshots/chart-windows/). Market prices/counts are capture
observations, not ongoing availability guarantees. Screen readers and long-duration
production soak remain unverified. No provider scheduling, history normalization,
persistence schema or request frequency changed.
