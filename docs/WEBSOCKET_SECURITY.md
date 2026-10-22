# WebSocket input and IPC bounds

This addresses the [maintainer's 2026-10-22 review](https://github.com/omacom/omarchy-plugin-marketplace/issues/12414#issuecomment-6332540678):
1.4.1 forwarded entire Binance/Coinbase ticker objects, including unused remote
fields, into the shared desktop shell. Its HTTP response ceilings did not cover
WebSocket messages. The fix applies limits before assembling/parsing messages
and sends only an explicit, small ticker schema across process boundaries.

## Receive and forwarding boundaries

- The bundled, integrity-pinned **ws 8.22.0** client limits Binance/Coinbase
  messages to **16,384 bytes**. It checks advertised lengths and cumulative
  fragmented payload lengths before waiting for/assembling those bodies.
- Limit a message to **32 fragments** and the receiver to **64 buffered chunks**.
  Compression is disabled; text UTF-8 and protocol validation remain enabled.
  Binary messages are rejected. HTTP upgrade headers stop at 8 KiB and the
  handshake at ten seconds. Redirects are disabled; TLS verification is enabled.
- A second check precedes JSON.parse. Only watched symbols survive projection.
  Binance keeps `s,c,P,h,l,q,b,a,E`; Coinbase keeps
  `product_id,price,open_24h,high_24h,low_24h,volume_24h,best_bid,best_ask,time`.
  Values must be finite numbers or at most 40 ASCII identifier/number/time
  characters. Arrays, objects, long fields and unknown fields are not forwarded.
- IPC records, including newline, stop at **2,048 bytes**. Pending stdout stops
  at **16 KiB**, and a backpressured write terminates the helper instead of
  queuing indefinitely. Parent EOF, termination and provider disable close the
  connection; the existing bounded reconnect logic restores later valid data.
- CryptoProvider rejects oversized or non-ASCII lines before JSON.parse and
  validates provider/status. Its existing normalizers reject unknown instruments.
  SplitParser receives only bounded records from this local trusted helper,
  rather than complete remote ticker objects.
- Subscriptions stop at 20 symbols. The legacy standalone Hyperliquid WS mode
  (unused by the plugin, which polls HTTP) has a 64 KiB message limit and projects
  only those subscribed mids into the same bounded IPC format.

These are application payload/queue limits, not a total process RSS ceiling;
Node, TLS and kernel socket buffers still exist. A provider outage or rejected
message can leave the last quote labelled stale while the client reconnects.

## Runtime and regression evidence

The [unmodified bundled source and MIT license](../third_party/ws/README.md)
require no npm installation, native addon or runtime download. Optional native
addon resolution is disabled before loading the client. There is no production
endpoint override; loopback routing is a test-only Node preload.

`bash tests/run_tests.sh` includes the real helper/receiver with loopback peers:
normal Binance/Coinbase fragmented JSON with an 8 KiB unused field; oversized
valid ticker data streamed toward 2 MiB; a 2^40-byte header with no body;
cumulative fragment overflow before the final payload; excess fragments;
invalid UTF-8, unsolicited compression and binary messages; stalled stdout;
compact projection, subscribed-symbol filtering, reconnect and parent EOF.
Pinned source hashes are checked too.

`node tests/run_ws_native.js` verifies the actual Quickshell provider and helper,
including header-only rejection, reconnect, projected quote/stat/currency values,
pre-parse IPC guards and process/socket cleanup. `./scripts/live-test.sh` now
checks the actual bounded production helper against the external providers,
instead of bypassing it with a different WebSocket implementation.

Full desktop integration, text/resource-load checks and existing HTTP recovery
checks remain separate in [TESTING.md](TESTING.md). Physical reboot/suspend and
long-duration soak are not established by these short regressions. Marketplace
approval remains the maintainer's decision on the exact submitted commit.
