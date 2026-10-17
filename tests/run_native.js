#!/usr/bin/env node
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'market-native-test-'));
const sockets = new Set();
const emptyHistory = fs.readFileSync(path.join(__dirname, 'fixtures/yahoo_tsla_empty_window.json'), 'utf8');
const sessionHistory = fs.readFileSync(path.join(__dirname, 'fixtures/yahoo_tsla_closed_session.json'), 'utf8');
const server = http.createServer((request, response) => {
  if (request.url === '/hang') return;
  if (request.url === '/history-empty' || request.url === '/history-session') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(request.url === '/history-empty' ? emptyHistory : sessionHistory); return;
  }
  if (request.url === '/fail') { response.writeHead(400); response.end('unavailable'); return; }
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(request.url === '/invalid' ? '{broken' : request.url === '/large' ? JSON.stringify({ value: 'x'.repeat(100) }) : '{"value":42}');
});
server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
fs.mkdirSync(path.join(directory, 'runtime'), { mode: 0o700 });
fs.mkdirSync(path.join(directory, 'config'));
const legacyDir = path.join(directory, 'config', 'Unknown Organization');
fs.mkdirSync(legacyDir);
fs.writeFileSync(path.join(legacyDir, 'quickshell.conf'), '[General]\nwatchlistJson=' + JSON.stringify('["ETH","BTC","AAPL"]') + '\n');
fs.symlinkSync(path.resolve(__dirname, '..'), path.join(directory, 'market'));
for (const name of ['Commons', 'Ui']) {
  const target = `/usr/share/omarchy/shell/${name}`;
  if (fs.existsSync(target)) fs.symlinkSync(target, path.join(directory, name));
}
const source = fs.readFileSync(path.resolve(__dirname, '../test_runtime.qml'), 'utf8')
  .replaceAll('import "models/', 'import "market/models/')
  .replace('import "providers"', 'import "market/providers"\nimport "market" as Market')
  .replace('  MarketService {', '  Market.MarketService {');
fs.writeFileSync(path.join(directory, 'shell.qml'), source);
function run(phase, port) {
  return new Promise((resolve, reject) => {
    const child = spawn('quickshell', ['-p', path.join(directory, 'shell.qml')], {
      env: { ...process.env, QT_QPA_PLATFORM: 'offscreen', QT_QPA_PLATFORMTHEME: 'generic', QT_QUICK_CONTROLS_STYLE: 'Basic', XDG_RUNTIME_DIR: path.join(directory, 'runtime'), XDG_CONFIG_HOME: path.join(directory, 'config'), MARKET_TEST_PHASE: phase, MARKET_TEST_URL: `http://127.0.0.1:${port}` }
    });
    let output = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 30000);
    child.on('error', reject);
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => output += data);
    child.on('close', code => {
      clearTimeout(timer);
      const marker = phase === 'restore' ? 'NATIVE_RESTORE_PASS' : 'NATIVE_PASS:';
      process.stdout.write(output);
      if (process.env.MARKET_TEST_KEEP) console.log("TEST_CONFIG", directory, fs.readdirSync(path.join(directory, "config"), { recursive: true }));
      if (code !== 0 || !output.includes(marker) || output.includes('NATIVE_FAIL') || /TypeError|ReferenceError|Failed to load configuration/.test(output)) reject(new Error('Native checks failed'));
      else resolve();
    });
  });
}
server.listen(0, '127.0.0.1', async () => {
  try { await run('write', server.address().port); await run('restore', server.address().port); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { for (const socket of sockets) socket.destroy(); server.close(); if (!process.env.MARKET_TEST_KEEP) fs.rmSync(directory, { recursive: true, force: true }); }
});
