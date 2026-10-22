// Test-only routing of the unmodified production bridge to a loopback peer.
// Loaded with --require only by the isolated regression processes.
'use strict';
const Module = require('node:module');
const load = Module._load;
Module._load = function (name, parent, isMain) {
  const value = load.call(this, name, parent, isMain);
  if (name === '../third_party/ws/lib/websocket' && parent.filename.endsWith('/scripts/ws_bridge.js')) {
    return class extends value {
      constructor(url, options) { super(process.env.MARKET_WS_TEST_URL, options); }
    };
  }
  return value;
};
