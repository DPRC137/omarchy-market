# HTTP recovery and marketplace hardening

## Reproduction and scope

Investigation on 2026-10-21 used Qt 6.12.0, Quickshell 0.3.2 and Node
26.12.0. After boot, the installed shell retained TCP connections with
retransmissions and no incoming data for more than ten minutes. Fresh native
requests worked, and restarting the shell restored quotes and history. The
initial network event remains unconfirmed: Wi-Fi became available about 26
seconds after shell startup, but that timing alone does not establish cause.

A deterministic local TLS proxy then reproduced the recovery failure. It
allowed an initial HTTP/2 request and stopped forwarding that connection while
accepting new connections normally. Release 1.4.0 reused the same Qt connection
for all three attempts and timed out. Aborting individual QML XHR requests did
not discard the shared connection. The candidate completes requests while the
host's Qt connection remains broken, without restarting the native process.

Production HTTP now uses a one-shot worker with a fresh connection for every
request. This avoids sharing the desktop's Qt pool. The existing provider
queues, priorities, spacing, cancellation and retry limits remain in place.
Qt deadlines and worker deadlines both bound stalled work. Workers close on
completion, cancellation, parent EOF and owner destruction. This uses the
already-required Node runtime; there is no new npm dependency or service.
Transient process startup cost is the tradeoff for isolated connection lifetime.

Yahoo returned HTTP 429 for requests without client identification while the
same request with an honest Omarchy Market User-Agent returned 200. Workers
identify the application and version. This does not eliminate provider quotas;
real outages and rate limits can still leave data explicitly stale.

A separate Qt 6.12 compatibility issue was confirmed: QtQuick now exports its
own Color singleton. Explicit Shell.Color references avoid the ambiguity and
restore clean native UI tests without changing the palette.

## Maintainer requirements from marketplace issue 6031

- [Response-byte ceiling rejection](https://github.com/omacom/omarchy-plugin-marketplace/issues/6031#issuecomment-5634981627):
  search must have a byte limit before parsing untrusted responses.
- [Rich text and buffering rejection](https://github.com/omacom/omarchy-plugin-marketplace/issues/6031#issuecomment-5783790167):
  Yahoo-controlled names/symbols must use PlainText; byte enforcement must also
  work without an honest Content-Length.

The new streaming regression exposed an important distinction: the previous
QML adapter reported an oversized response, but the server still sent its
entire 2 MiB stream. The worker closes oversized streams at 128 KiB for search
and 1 MiB for quote/history data, before JSON parsing, even without a length
header. It rejects oversized declared lengths, bounds request input, retains
TLS verification, requests identity encoding and does not follow redirects.

The redesigned UI already renders dynamic name/symbol/error sinks as PlainText.
A new native adversarial test puts image markup into five actual search,
watchlist, detail and diagnostic text sinks and checks both their textFormat
and zero requests to a local image URL.

## Validation

- Portable suite, including actual HTTP-worker malformed/status/byte-limit/
  timeout/disconnection/EOF tests.
- Native service, forced quote refresh/freshness, streamed search/data ceilings,
  settings restart, history/session recovery and cancellation.
- Native black-holed HTTP/2, unavailable startup, GET/POST, cancellation and
  shutdown socket cleanup. The unchanged 1.4.0 release fails the same regression.
- Native UI, ticker, chart and selected-window statistics on Qt 6.12.
- Live BTC 1W (168 observations) and AAPL 1M (155 observations) charts and matching selected-window statistics.
- Native hostile text and resource-load tripwire.
- Host manifest validation and QML lint; existing var-scope style advice is
  reported as information on Qt 6.12, not hidden.

The local fault fixture requires a compiler and Qt development tools only for
testing. It trusts its generated certificate only inside its temporary test
process; it does not alter system trust or ship a compiled runtime module.
Physical reboot/suspend and exhaustive proxy/custom-CA environments remain
outside this validation. The original network trigger is not proven.

## Marketplace publication

[Issue 12414](https://github.com/omacom/omarchy-plugin-marketplace/issues/12414)
requests verification of the 1.4.1 update. Automated compatibility checks passed
and the baseline reported zero findings on the released transport fix. Maintainer
security review remains required for the existing remote-build capability
associated with repository installation; automated checks are not approval.
Every newer submission snapshot, including documentation or artwork updates,
needs its own exact-commit verification and cannot inherit an older result.
