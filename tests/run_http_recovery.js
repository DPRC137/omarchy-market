#!/usr/bin/env node
'use strict';
// Native HTTP/2 fault test. Requires Quickshell, Qt development tools, c++,
// pkg-config and openssl. All certificates, settings and sockets are temporary.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http2 = require('node:http2');
const { spawn, execFileSync } = require('node:child_process');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'market-http-recovery-'));
const sockets = new Set();
const links = new Map();
const observed = [];
let child, server, proxy, bootProxy, deadline, blackHoled = false, bootUnavailable = true;
const listen = value => new Promise(resolve => value.listen(0, '127.0.0.1', resolve));
function makeProxy(boot) {
  return net.createServer(front => {
    if (boot && bootUnavailable) {
      front.destroy();
      setTimeout(() => { bootUnavailable = false; }, 300);
      return;
    }
    const back = net.connect(server.address().port, '127.0.0.1');
    const link = { blocked: false };
    for (const socket of [front, back]) {
      sockets.add(socket);
      socket.on('error', () => {});
      socket.on('close', () => sockets.delete(socket));
    }
    back.on('connect', () => links.set(back.localPort, link));
    front.on('data', data => { if (!link.blocked) back.write(data); });
    back.on('data', data => { if (!link.blocked) front.write(data); });
    front.on('close', () => back.destroy());
    back.on('close', () => front.destroy());
  });
}
async function main() {
  const flags = execFileSync('pkg-config', ['--cflags', '--libs', 'Qt6Qml', 'Qt6Network'], { encoding: 'utf8' }).trim().split(/\s+/);
  const libexec = execFileSync('pkg-config', ['--variable=libexecdir', 'Qt6Core'], { encoding: 'utf8' }).trim();
  const trustDir = path.join(directory, 'MarketTestTrust');
  fs.mkdirSync(trustDir);
  const source = path.join(directory, 'TrustPlugin.cpp');
  fs.copyFileSync(path.join(__dirname, 'fixtures/TrustPlugin.cpp'), source);
  const includes = flags.filter(flag => flag.startsWith('-I') || flag.startsWith('-D'));
  execFileSync(path.join(libexec, 'moc'), [...includes, source, '-o', path.join(directory, 'TrustPlugin.moc')]);
  execFileSync(process.env.CXX || 'c++', ['-shared', '-fPIC', source, '-o', path.join(trustDir, 'libtrust.so'), ...flags]);
  fs.writeFileSync(path.join(trustDir, 'qmldir'), 'module MarketTestTrust\nplugin trust\n');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', directory + '/key.pem', '-out', directory + '/cert.pem', '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'], { stdio: 'ignore' });
  server = http2.createSecureServer({ key: fs.readFileSync(directory + '/key.pem'), cert: fs.readFileSync(directory + '/cert.pem'), allowHTTP1: true });
  server.on('sessionError', () => {});
  server.on('request', (request, response) => {
    observed.push([request.url, request.httpVersion]);
    if (request.url === '/hang') return;
    if (request.url === '/warm') {
      assert.equal(request.httpVersion, '2.0', 'Fixture did not exercise HTTP/2');
      const link = links.get(request.socket.remotePort);
      setTimeout(() => { link.blocked = true; blackHoled = true; }, 100);
    }
    let body = '';
    request.on('data', chunk => body += chunk);
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ value: 42, method: request.method, body }));
    });
  });
  await listen(server);
  proxy = makeProxy(false); bootProxy = makeProxy(true);
  await listen(proxy); await listen(bootProxy);
  fs.symlinkSync(path.resolve(process.argv[2] || path.join(__dirname, '..')), path.join(directory, 'market'));
  fs.copyFileSync(path.join(__dirname, 'http_recovery_runtime.qml'), path.join(directory, 'shell.qml'));
  fs.mkdirSync(path.join(directory, 'runtime'), { mode: 0o700 });
  fs.mkdirSync(path.join(directory, 'config'));
  let output = '';
  const code = await new Promise((resolve, reject) => {
    child = spawn('quickshell', ['-p', path.join(directory, 'shell.qml')], { env: {
      ...process.env, QT_QPA_PLATFORM: 'offscreen', QT_QPA_PLATFORMTHEME: 'generic', QT_QUICK_CONTROLS_STYLE: 'Basic', QML_IMPORT_PATH: directory,
      XDG_RUNTIME_DIR: path.join(directory, 'runtime'), XDG_CONFIG_HOME: path.join(directory, 'config'),
      MARKET_TEST_CA: directory + '/cert.pem', NODE_EXTRA_CA_CERTS: directory + '/cert.pem',
      MARKET_TEST_URL: 'https://127.0.0.1:' + proxy.address().port,
      MARKET_BOOT_URL: 'https://127.0.0.1:' + bootProxy.address().port
    } });
    child.on('error', reject);
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => output += data);
    deadline = setTimeout(() => child.kill('SIGTERM'), 30000);
    child.on('close', resolve);
  });
  clearTimeout(deadline);
  process.stdout.write(output);
  console.log('Observed local requests:', JSON.stringify(observed));
  assert.equal(code, 0);
  assert.ok(blackHoled && output.includes('HTTP_RECOVERY_PASS:') && !/RECOVERY_FAIL|TypeError|ReferenceError|Failed to load configuration/.test(output), 'Native HTTP recovery failed');
  assert.ok(observed.some(([url, version]) => url === '/recover' && version === '1.1'), 'Recovery did not bypass the dead HTTP/2 session');
  assert.ok(observed.some(([url]) => url === '/boot'), 'Offline-startup request never recovered');
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(sockets.size, 0, 'Worker or Qt sockets remained after shutdown');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => {
  clearTimeout(deadline);
  if (child && child.exitCode === null) child.kill('SIGTERM');
  for (const socket of sockets) socket.destroy();
  for (const value of [proxy, bootProxy, server]) if (value) value.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
