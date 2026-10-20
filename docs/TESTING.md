# Verification

## Portable CI

`bash tests/run_tests.sh` runs production JavaScript functions from MarketModel,
RequestQueue and History with deterministic clocks/transports, the actual bridge
script with a fake WebSocket runtime, JS syntax, shell syntax and manifest entry
checks. GitHub Actions runs this on Node 22/24/26 with no npm installation.

Material cases include elapsed freshness and recovery, closed-market status,
null metrics, currency/share/base-volume units, international currency migration,
ordered legacy watchlists, rapid asset/range changes, generation/provider/
instrument/interval validation, old and out-of-order responses, cache expiry,
forced refresh, empty history, retry, captured closed-session payloads, bounded
empty-success recovery, session boundaries/half days and first-candle display, queue bounds/priority/deduplication,
finite backoff, silent-transport deadlines, cancellation, late callbacks, and
bridge reconnect/parent-EOF cleanup. Recovery tests check individual instruments
and sources, throttled outage retries, and closed-market freshness. Bridge tests
cover connections that never open and sockets whose close emits no event.
These tests execute production modules;
they do not implement copied schedulers or assert QML source strings.

`bash tests/test_fault_injection.sh` runs deterministic faults without killing
processes or changing the user's enabled plugins. The historical
`test_v121_regressions.js` entry point delegates to the production history tests.

## Native checks (separate from CI)

- `bash tests/lint_qml.sh`: real Qt qmllint with Quattro module paths. Dynamic
  host QObject members, unqualified dynamic delegates and the Quickshell exit
  enum lack complete tooling types; those categories are explicitly disabled.
  Other warnings/errors fail. This is not a claim of zero warnings from an
  unfiltered lint run.
- `node tests/run_native.js`: starts a private localhost HTTP server and actual
  Quickshell in offscreen mode with isolated runtime/config directories. Checks
  real XHR JSON/parse/size/error/timeout/cancel paths, production Yahoo search
  error delivery, manual replacement of blocked quote requests without cancelling
  search/history, a stale quote becoming current after refresh, ordered Undo,
  stock-only provider/process shutdown, and a
  second process to verify watchlist/pin/rotation persistence. The first process
  starts with a legacy General-group watchlist to exercise installed migration. No provider access
  is required for the assertions. Startup provider requests may begin briefly
  before the test switches watchlists and cancels them. Captured Yahoo payloads
  also pass through real QML XHR and the production history controller to verify
  empty-success recovery without a live-provider dependency.
- `node tests/run_ui.js`: requires Wayland, QtTest and installed Quattro imports.
  It renders the real popup in a temporary host and drives Qt pointer/keyboard
  events: row -> detail, Back/Escape, search typing/arrows/Enter, Tab, Undo, the Manage bar-ticker selector and
  close cleanup. Enlarged font/spacing is exercised. `node tests/run_ui.js ticker`
  also checks the actual bar widget: content sizing, hover guard/cleanup, direct
  displayed-asset chart opening, currency metadata and optional rotation. It never replaces or
  disables the installed shell. It is a short integration check, not exhaustive
  accessibility or multi-monitor QA.
- `node tests/run_ui.js equity`: optional live Yahoo/Wayland regression. Opens
  TSLA detail in an isolated native host, requires actual session candles and
  a quote, and verifies source/currency/session metadata. Set
  `MARKET_EQUITY_CAPTURE=/absolute/path.png` to capture the real rendered chart.
  Network failure fails this optional live check; portable CI remains deterministic.
- `./scripts/live-test.sh`: optional live WebSocket probe. Network, regional
  blocks and provider outages can fail it independently of correctness.

Never run live tests as a substitute for deterministic regressions. Never infer
live-provider or rendered UI success from Node tests.

## Evidence from this change

Verified locally with Node 26.10.0, Quickshell 0.3.1 and installed Qt/Quattro:
portable suite, fault suite, filtered qmllint, native HTTP/settings restart and
real Wayland pointer/keyboard checks. Rendered original and updated popups in
isolated hosts; captured actual content for PR review. Live Binance quotes and
history, Coinbase comparison quotes, and Hyperliquid context quotes were
observed. The reported TSLA closed-market failure was reproduced live: rolling
24h returned HTTP 200 without candles, while `range=1d` returned 79. After the fix,
the actual native popup rendered all 79 candles for 2026-10-16 with the session
date explicitly labelled. Captured responses are checked into fixtures. This
short observation does not establish ongoing Yahoo availability. Live holiday transitions, exhaustive multi-monitor
scaling, screen readers and long-duration resource/soak behavior remain outside
this short verification. Yahoo response normalization/session cases use fixtures.

Screenshots show live data at capture time, not reproducible price expectations.

Native captures: [original detail](screenshots/before-detail.png),
[updated watchlist](screenshots/after-watchlist.png),
[updated detail](screenshots/after-detail.png),
[final detail typography](screenshots/after-detail-header.png),
[closed-market equity session](screenshots/after-equity-session.png). These are the actual popup's
content rendered on Wayland with Quattro imports, excluding surrounding desktop.

The [1.3.0 README gallery](screenshots/README.md) contains fresh captures of the
final crypto/equity detail, watchlist and Manage screens, including the native
card background and border. All market data in those captures came from live
providers in an isolated host.
