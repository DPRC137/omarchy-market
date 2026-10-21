'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const sockets = new Set();
const children = new Set();
const server = http.createServer((request, response) => {
  if (request.url === '/hang') return;
  if (request.url === '/disconnect') { response.writeHead(200); response.write('{'); response.socket.destroy(); return; }
  if (request.url === '/400' || request.url === '/429') { response.writeHead(Number(request.url.slice(1))); response.end(); return; }
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/invalid') { response.end('{broken'); return; }
  if (request.url === '/large-header') { response.setHeader('Content-Length', '100000'); response.end('{}'); return; }
  if (request.url === '/large-stream') { response.write('{"value":"'); response.end('x'.repeat(1000) + '"}'); return; }
  if (request.url === '/unicode') { response.end('{"value":"€"}'); return; }
  let body = '';
  request.on('data', chunk => body += chunk);
  request.on('end', () => response.end(JSON.stringify({ method: request.method, body, value: 42 })));
});
server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
function run(request, terminate = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '../scripts/http_request.js')]);
    children.add(child);
    let output = '', error = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Worker did not exit')); }, 4000);
    child.on('error', reject);
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => error += data);
    child.on('close', code => {
      children.delete(child); clearTimeout(timeout);
      try {
        if (terminate) { assert.equal(output, ''); resolve(); return; }
        assert.equal(code, 0, error);
        resolve(JSON.parse(output));
      } catch (e) { reject(e); }
    });
    child.stdin.write(typeof request === 'string' ? request : JSON.stringify(request) + '\n');
    if (terminate) setTimeout(() => child.stdin.end(), 150);
  });
}
server.listen(0, '127.0.0.1', async () => {
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await run({ url })).data.value, 42);
    assert.deepEqual((await run({ url, body: '{"type":"metaAndAssetCtxs"}' })).data, { value: 42, method: 'POST', body: '{"type":"metaAndAssetCtxs"}' });
    assert.deepEqual(await run({ url: url + '/400' }), { error: 'HTTP 400', retryable: false });
    assert.deepEqual(await run({ url: url + '/429' }), { error: 'HTTP 429', retryable: true });
    assert.equal((await run({ url: url + '/invalid' })).error, 'Invalid JSON');
    for (const route of ['/large-header', '/large-stream', '/unicode']) assert.equal((await run({ url: url + route, maxBytes: 10 })).error, 'Response too large');
    assert.equal((await run({ url: url + '/hang', timeout: 100 })).error, 'Request timed out');
    assert.equal((await run({ url: url + '/disconnect' })).retryable, true);
    assert.equal((await run({ url: 'file:///etc/passwd' })).error, 'Unsupported request URL');
    assert.equal((await run({ url, body: 'x'.repeat(17000) })).error, 'Request body too large');
    assert.equal((await run('{invalid\n')).error, 'Invalid request');
    assert.equal((await run('x'.repeat(32769))).error, 'Request too large');
    await run({ url: url + '/hang' }, true);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(sockets.size, 0, 'Worker left a connection open after exit/parent EOF');
    console.log('PASS fresh HTTP worker: GET/POST, status, JSON/byte bounds, timeout, disconnection, parent EOF and socket cleanup');
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { for (const child of children) child.kill(); for (const socket of sockets) socket.destroy(); server.close(); }
});
