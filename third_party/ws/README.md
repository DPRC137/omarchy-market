# Bundled ws client

Omarchy Market bundles the unmodified client-side sources of **ws 8.22.0**
(MIT), upstream commit `297202cdae9b0590629821373b3b679c407f3431`:
https://github.com/websockets/ws/tree/8.22.0

`LICENSE` retains upstream copyright and permission notices. `UPSTREAM.json`
records the official registry tarball URL, its verified SHA-512 integrity and
SHA-256 of every retained upstream file. Portable tests verify those file hashes.
The server, stream wrapper, examples, tests and optional native addons are not
bundled. Retained sources are not locally patched.

Production requires `lib/websocket.js` directly. The bridge disables optional
addon resolution before loading it, and disables compression. All required
runtime imports are bundled JavaScript or Node standard-library modules.
Installation does **not** run npm, compile addons, or fetch executable code.

This client replaces the WHATWG client because it exposes pre-assembly message,
fragment and buffered-chunk limits. The options and application IPC boundary are
documented in [WebSocket security](../../docs/WEBSOCKET_SECURITY.md).
