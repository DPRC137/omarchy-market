#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
if (!process.env.WAYLAND_DISPLAY) throw new Error('Native UI checks require a Wayland session and Omarchy/Quattro');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'market-ui-test-'));
for (const name of ['Commons', 'Ui']) fs.symlinkSync(`/usr/share/omarchy/shell/${name}`, path.join(directory, name));
fs.symlinkSync(path.resolve(__dirname, '..'), path.join(directory, 'market'));
const harness = process.argv[2] === 'chart' ? 'chart_runtime.qml' : process.argv[2] === 'ticker' ? 'ticker_runtime.qml' : process.argv[2] === 'equity' ? 'equity_runtime.qml' : 'ui_runtime.qml';
fs.copyFileSync(path.join(__dirname, harness), path.join(directory, 'shell.qml'));
const child = spawn('quickshell', ['-p', path.join(directory, 'shell.qml')], { env: { ...process.env, QT_QPA_PLATFORM: 'wayland', QT_QUICK_CONTROLS_STYLE: 'Basic', XDG_CONFIG_HOME: path.join(directory, 'config') } });
let output = '';
const timer = setTimeout(() => child.kill('SIGTERM'), process.argv[2] === 'equity' ? 25000 : 10000);
child.stdout.on('data', data => output += data);
child.stderr.on('data', data => output += data);
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('close', code => {
  clearTimeout(timer); process.stdout.write(output);
  if (code !== 0 || !output.includes('UI_PASS:') || /UI_FAIL|TypeError|ReferenceError|Failed to load configuration/.test(output)) process.exitCode = 1;
  fs.rmSync(directory, { recursive: true, force: true });
});
