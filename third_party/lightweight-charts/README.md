# TradingView Lightweight Charts geometry

`models/ChartGeometry.js` contains a native QML JavaScript adaptation of the
Steffen monotone curve helper in TradingView Lightweight Charts:

https://github.com/tradingview/lightweight-charts/blob/82e14e72776fa8b91ab94de0eaac9ab4b0c6c1cd/src/renderers/walk-line.ts

Changes: removed TypeScript/browser types, emit native Canvas Bezier segments
from an array, validate increasing coordinates, and expose the limiter for tests.
The price-axis tick/scale helper is local application code. The rest of the
TradingView charting library is not embedded or required at runtime.

The upstream Apache-2.0 license and NOTICE are included in this directory.
