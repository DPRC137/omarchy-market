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

## Historical 1.3.0 evidence

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

## Unreleased native redesign

See [the current validation record](NATIVE_REDESIGN.md) for commands, rendered
states, integration fixes, resource comparison and remaining limits.
`bash tests/run_tests.sh` additionally exercises the production watchlist view
projection without mutating saved order. `node tests/run_ui.js` now covers
search duplicate protection, actual Alt+arrow ordering, remove/Undo focus and
narrow enlarged-text navigation bounds. `node tests/run_ui.js chart` covers
single/empty history, timestamp spacing, invalid observations and real keyboard
inspection. The standalone chart test explicitly requests Wayland keyboard
focus, just as the production KeyboardPanel does.

`node tests/capture_ui.js` captures the real popup card using normalized saved
provider fixtures. It checks that the equity session and crypto quote are present
before rendering. Screenshots default to `/tmp/market-redesign-captures`; use
`MARKET_CAPTURE_DIR` to choose another output directory. `MARKET_CAPTURE_REPO`
allows the same capture workload to run against a preserved baseline checkout.
The private capture host starts no market providers and changes no user settings.

## Chart-window follow-up

`node tests/run_ui.js window` drives the real detail component through all four
ranges and checks selected-window returns, extrema, mean, currency, stale cache,
loading, absent history and one close, independently of the current daily quote.
The portable suite includes the production statistics and adapted curve geometry:
exact observations, no overshoot, no mutation, slope/Bezier reference vectors,
readable price ticks and missing/flat histories. `node tests/run_ui.js chart`
also verifies closure compression and actual timestamp/price inspection.

The live equity harness accepts `MARKET_EQUITY_ASSET` and `MARKET_EQUITY_RANGE`
(default TSLA/1D). For example:

```bash
MARKET_EQUITY_ASSET=AAPL MARKET_EQUITY_RANGE=1M \
  MARKET_EQUITY_CAPTURE=/tmp/aapl-month.png node tests/run_ui.js equity
```

Its screenshot includes the real native card. It checks that the selected-window
summary matches the actual returned history. See [chart-window evidence](CHART_WINDOWS.md).

## Public gallery capture

`node tests/capture_gallery.js` uses the same isolated native capture infrastructure
with production providers and components. `grim` captures only the on-screen
popup card at its displayed dimensions. Every view opens in a fresh temporary
host with the same 600×800 card and 14px base font. It waits for all six example
quotes to be current/live, the active chart to have ready history and matching
summary, search to finish where applicable, and provider refresh work to stop.
A further two-second settled interval precedes capture. The runner verifies that
all seven PNGs have identical pixel dimensions. Missing history, incomplete
quotes, provider failures or loading timeouts fail the run instead of publishing
an incomplete image. These are optional live captures, not deterministic CI.
Use `MARKET_CAPTURE_DIR` to choose the output directory. The installed watchlist
and settings are untouched. See the [current gallery](screenshots/v1.4.0/README.md).
