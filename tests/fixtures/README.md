# Provider fixtures

`yahoo_tsla_empty_window.json` and `yahoo_tsla_closed_session.json` are actual
Yahoo v8 chart responses captured on 2026-10-18 (Asia/Kolkata) while reproducing
the reported blank TSLA chart. At capture time the rolling 24-hour `period1` /
`period2` request returned HTTP 200 without candles, while `range=1d&interval=5m`
returned 79 candles from the regular session of 2026-10-16. These contain public
market data, no user/account credentials. Tests use fixed clocks and do not
expect Yahoo prices to remain constant or make network requests.

Older fixtures remain for normalizer regressions.
