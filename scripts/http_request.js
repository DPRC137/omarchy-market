#!/usr/bin/env node
'use strict';

// One bounded request per process. No shared agent or inherited Qt connection
// pool: a timed-out desktop connection cannot poison later recovery attempts.
const http = require('node:http');
const https = require('node:https');
const version = require('../manifest.json').version;
let active = null;
let timer = null;
let finished = false;
let input = '';

function finish(result) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (active) active.destroy();
  process.stdout.end(JSON.stringify(result) + '\n');
  process.stdin.destroy();
}

function run(request) {
  let url;
  try { url = new URL(request.url); }
  catch { finish({ error: 'Invalid request URL' }); return; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    finish({ error: 'Unsupported request URL' }); return;
  }
  const maxBytes = Math.min(1048576, Math.max(1, Number(request.maxBytes) || 1048576));
  const timeout = Math.min(30000, Math.max(1, Number(request.timeout) || 8000));
  const body = request.body || '';
  if (typeof body !== 'string' || Buffer.byteLength(body) > 16384) {
    finish({ error: 'Request body too large' }); return;
  }
  const headers = { Accept: 'application/json', 'Accept-Encoding': 'identity', 'User-Agent': 'OmarchyMarket/' + version + ' (+https://github.com/DPRC137/omarchy-market)' };
  if (body) headers['Content-Type'] = 'application/json';
  timer = setTimeout(() => finish({ error: 'Request timed out', retryable: true }), timeout);
  active = (url.protocol === 'https:' ? https : http).request(url, {
    method: body ? 'POST' : 'GET', agent: false, headers
  }, response => {
    const status = response.statusCode;
    if (status !== 200) {
      finish({ error: 'HTTP ' + status, retryable: status === 429 || status >= 500 }); return;
    }
    if (Number(response.headers['content-length']) > maxBytes) {
      finish({ error: 'Response too large' }); return;
    }
    let size = 0;
    const chunks = [];
    response.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) { finish({ error: 'Response too large' }); return; }
      chunks.push(chunk);
    });
    response.on('error', () => finish({ error: 'Network request failed', retryable: true }));
    response.on('end', () => {
      try { finish({ data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
      catch { finish({ error: 'Invalid JSON' }); }
    });
  });
  active.on('error', () => finish({ error: 'Network request failed', retryable: true }));
  active.end(body);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (finished || active) return;
  input += chunk;
  if (Buffer.byteLength(input) > 32768) { finish({ error: 'Request too large' }); return; }
  const end = input.indexOf('\n');
  if (end < 0) return;
  try { run(JSON.parse(input.slice(0, end))); }
  catch { finish({ error: 'Invalid request' }); }
});
process.stdin.on('end', () => { if (!finished) process.exit(0); });
process.stdout.on('error', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
