#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { peer, header, frame, ticker } = require('./ws_fixture');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'market-ws-native-'));
let connections = 0, rejected = false;
const server = peer(socket => {
  connections++;
  if (connections === 1) {
    socket.on('close', () => { rejected = true; });
    socket.write(header(2*1024*1024)); // No body: limit must work from header.
  } else socket.write(frame(ticker('binance', 'x'.repeat(8000))));
});
(async () => {
  fs.mkdirSync(path.join(directory, 'runtime'), { mode:0o700 });
  fs.symlinkSync(path.resolve(__dirname, '..'), path.join(directory, 'market'));
  fs.copyFileSync(path.join(__dirname, 'ws_runtime.qml'), path.join(directory, 'shell.qml'));
  const url = await server.listen();
  const child = spawn('quickshell', ['-p', path.join(directory, 'shell.qml')], {
    env: { ...process.env, QT_QPA_PLATFORM:'offscreen', QT_QPA_PLATFORMTHEME:'generic', QT_QUICK_CONTROLS_STYLE:'Basic', XDG_RUNTIME_DIR:path.join(directory,'runtime'), XDG_CONFIG_HOME:path.join(directory,'config'), MARKET_WS_TEST_URL:url, NODE_OPTIONS:'--require '+path.join(__dirname,'fixtures/ws_loopback.cjs') }
  });
  let output = '';
  const timer = setTimeout(() => child.kill('SIGTERM'), 14000);
  child.stdout.on('data', d => output+=d); child.stderr.on('data', d => output+=d);
  await new Promise((resolve,reject) => { child.on('error',reject);child.on('close',code => { clearTimeout(timer); process.stdout.write(output);try {assert.equal(code,0);assert.ok(output.includes('WS_NATIVE_PASS:'));assert.ok(!/WS_NATIVE_FAIL|TypeError|ReferenceError/.test(output));resolve()} catch(e){reject(e)} }) });
  assert.ok(rejected && connections === 2, 'actual helper did not reject/recover from oversized header');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(server.sockets.size,0,'parent/disable left WebSocket sockets alive');
  console.log('PASS native production WebSocket budget and shell IPC boundary');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await server.close();fs.rmSync(directory,{recursive:true,force:true})});
