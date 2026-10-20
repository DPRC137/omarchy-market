# Native redesign validation

Unreleased work on `codex/native-market-redesign`, integrated with master `079c518`.
Validation completed on 2026-10-21 (Asia/Kolkata), using Node 26.10.0,
Quickshell 0.3.1 and the installed Qt/Quattro modules.

## Integrated result

One native visual system covers watchlist filtering/category/sort views, asset
detail/history, and management. Sorting is an immutable projection of the saved
order. The detail distinguishes quote currency, comparison period, session,
freshness and mark price versus trade-candle history. Manage provides discovery,
duplicate/limit states, contextual editing, keyboard reordering, removal/Undo,
pinning and rotation. The header remains available above the content scroller.

Previous parallel work was integrated rather than recreated: the visual agent
supplied tokens/actions/watchlist/projection; the detail agent supplied detail,
chart and chart tests; the management agent supplied Manage and interaction tests.
The integration pass completed their shared contracts, corrected defects, and
performed native verification. No additional agents were started on resumption.

The isolated checkout is separate from the original checkout. The unrelated
recovery work was completed independently and arrived on master as `079c518`
during final verification. That upstream commit was merged here, resolving only
the navigation overlap and retaining both recovery and watchlist-projection tests.
The original checkout was never edited by this task. Relative to current master,
this branch changes no production provider, service, settings schema, bar widget,
deployment configuration or release version.

## Passing checks

| Command | Result and scope |
| --- | --- |
| `bash tests/run_tests.sh` | PASS: all existing production model/provider queue/history/session/subprocess cases, plus immutable watchlist filtering/sorting |
| `bash tests/lint_qml.sh` | PASS: existing filtered qmllint policy, including all new UI components |
| `bash tests/test_fault_injection.sh` | PASS: malformed/null data, queue failures/backoff/deadlines, stale-cache history, cancellation and bridge EOF/reconnect |
| `node tests/run_native.js` | PASS: real QML HTTP parse/failure/timeout/cancel, legacy settings migration, ordered Undo, persisted order/pin/rotation after restart, stock-only subprocess cleanup |
| `node tests/run_ui.js` | PASS: real pointer navigation, search typing/arrows/Enter, duplicates, selector, Alt+arrow ordering and focus, remove/Undo and focus, enlarged text/narrow navigation bounds, closing history cleanup |
| `node tests/run_ui.js chart` | PASS: empty/single observation, actual timestamp spacing/gaps, missing observations, keyboard inspection and unchanged-data inspection stability |
| `node tests/run_ui.js ticker` | PASS: compact bar, stable hover width, hover guard cleanup, displayed-asset detail, exact currency, Back and optional rotation |
| `node tests/run_ui.js equity` | PASS: live Yahoo TSLA quote and 68 real candles, session 2026-10-20, USD and session metadata; captured at price 375.45 while regular session was reported |
| `node tests/capture_ui.js` | PASS: 11 real native card screenshots using normalized provider fixtures, the active dark palette, 300px card and 18px base font |
| `git diff --check` | PASS |

Native checks used temporary settings. The capture host starts no providers.
Final process inspection found no remaining native test hosts or bridges from
this checkout. No Quickshell core dumps were listed for the validation date.

## Failures found and resolved

- Removal destroyed its delegate before the click handler could restore focus,
  causing `ReferenceError: root is not defined`. Parent-owned removal recovery
  now survives row destruction; the real remove/Undo/focus assertions pass.
- Deferred Back focus could run after another view opened. It now checks the
  current view/open state. Deferred Manage focus is guarded the same way.
- The reorder test dispatched input before scheduled search focus settled.
  Navigation and keyboard actions now run in distinct event-loop turns, with
  all ordering/focus assertions retained.
- The standalone chart test did not acquire Wayland keyboard focus. It now
  requests focus explicitly; production uses the host KeyboardPanel.
- Clearing a focused chart attempted to disable tab focus on the active item.
  Empty history releases chart focus first; the warning no longer occurs.
- Enlarged-text detail navigation overlapped at narrow widths. The fixed header
  now wraps controls, and native assertions check both bounds and intersections.
- Manage search passed a numeric alpha as a color, yielding a black field in a
  light palette. Its fill now uses the shared theme color token.
- Initial capture fixtures used the wrong clock/envelope and supplied equity
  history metadata to a crypto detail. The harness now validates real session
  candles and the normalized BTC quote and scopes history metadata to its asset.
  Initial incorrect screenshots were replaced with the final captures.
- One capture attempt lost its mapped surface before a grab completed. It failed
  the run rather than claiming success; subsequent mapped-surface captures pass.

The host emits a portal-registration warning in short-lived UI test processes.
The offscreen service test reports the expected Wayland/offscreen warning.
Neither produced a test failure or a QML exception in the passing final runs.

## Rendered evidence

[Gallery and provenance](screenshots/README.md). The screenshots cover watchlist,
crypto detail with stale/missing history, closed equity session with 79 saved
candles, Manage, search results, empty/loading/unavailable/single-observation
states, the active dark palette and narrow enlarged text. The live Yahoo
content capture is separate from those deterministic examples.

Inspected actual rendered text, alignment, source/currency/session labels,
chart axes, theme fills and narrow navigation. The header now wraps without
covering controls; overflow content remains scrollable. The existing historical
screenshots were also inspected as baseline context.

## Resource comparison

The same 11-state fixture capture workload ran against preserved master and the
redesign, each in a fresh Python wrapper using `subprocess.run` and
`resource.getrusage(RUSAGE_CHILDREN)`. Both use native Quickshell and saved fixtures,
with no provider requests. Raw observations are in
[`resources.json`](screenshots/redesign/resources.json).

| Observation | Master baseline | Redesign |
| --- | ---: | ---: |
| Wall time | 8.718 s | 8.871 s |
| Maximum process RSS | 327452 KiB | 337668 KiB |
| User CPU time | 1.912 s | 4.394 s |
| System CPU time | 0.497 s | 1.039 s |

This is one short render/capture workload, including startup, layout, screenshot
readback and enlarged text. Maximum RSS is the maximum individual process,
not total desktop or plugin-only memory. The redesigned cards render more pixels
and controls, and the transient CPU measurement increased. It does not establish
idle CPU, sustained network cost or long-duration leak behavior; those remain
unverified. No performance-improvement claim is made.

## Crash evidence and remaining limits

The two available pre-redesign Quickshell cores (PIDs 20795/20797, 2026-10-20
17:21:52 IST) belonged to a temporary UI-test launch and its crash helper.
Their stacks abort in Qt GUI initialization before loading QML. Native tests
subsequently work with Wayland access. This supports a test-launch/display-access
explanation; it does not establish the cause of an unidentified notification in
a screenshot or attribute a crash to this plugin. No core memory was extracted.

Screen-reader testing, exhaustive multi-monitor/DPI/reduced-motion combinations,
long-duration production resource/network soak, live holiday transitions, and
new live Binance/Coinbase/Hyperliquid probes were not performed in this pass.
Closed equity behavior was rendered from the saved real session payload; the
separate live Yahoo check reported a regular session. Only Node 26 was run
locally; the existing Node 22/24/26 CI matrix remains intact.

Watchlist sparklines, a command palette and optional feature breadth remain
deferred. The artificial light-palette capture override was removed at the user’s request;
final screenshots and narrow-layout checks use the active dark Omarchy theme.
Theme-token inheritance remains intact. The core is ready for Draft PR review with the verification limits
above; it has not been merged, released or installed over the user's live plugin.
