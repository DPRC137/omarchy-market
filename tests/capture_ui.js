#!/usr/bin/env node
'use strict';
// Real native popup screenshots. Fixture values are intentionally not live data.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const load = require('./load_model');
const M = load('MarketModel'), H = load('History');
const repo = path.resolve(process.env.MARKET_CAPTURE_REPO || path.join(__dirname, '..'));
const out = path.resolve(process.env.MARKET_CAPTURE_DIR || '/tmp/market-redesign-captures');
fs.mkdirSync(out, {recursive:true});
const directory = fs.mkdtempSync(path.join(os.tmpdir(),'market-capture-'));
for (const name of ['Commons','Ui']) fs.symlinkSync(`/usr/share/omarchy/shell/${name}`,path.join(directory,name));
fs.symlinkSync(repo,path.join(directory,'market'));
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',name),'utf8'));
const yahoo = fixture('yahoo_tsla_closed_session.json');
const now = Date.parse('2026-10-18T16:00:00Z');
const spec = H.specification('TSLA','yahoo','1D',now);
spec.currency = 'USD';
const candles = H.normalize(yahoo,spec);
if (!candles.length || !spec.sessionDate) throw new Error('Screenshot fixture must include a real regular session');
const tsla = M.normalizeYahooChart(yahoo,now);
const btc = M.normalizeBinanceTicker(fixture('binance_btc.json').data,now);
if (!btc || !btc.price || btc.currency !== 'USDT') throw new Error('Screenshot fixture must include a normalized crypto quote');
const source = fs.readFileSync(path.join(__dirname,'visual_runtime.qml'),'utf8')
 .replace('__FIXTURE_DATA__',JSON.stringify({now,tsla,btc,candles,sessionDate:spec.sessionDate}));
fs.writeFileSync(path.join(directory,'shell.qml'),source);
const child=spawn('quickshell',['-p',path.join(directory,'shell.qml')], {env:{...process.env,QT_QPA_PLATFORM:'wayland',QT_QUICK_CONTROLS_STYLE:'Basic',QT_QPA_PLATFORMTHEME:'generic',XDG_CONFIG_HOME:path.join(directory,'config'),MARKET_CAPTURE_DIR:out}});
let output='';
child.stdout.on('data',d=>output+=d); child.stderr.on('data',d=>output+=d);
const timeout=setTimeout(()=>child.kill('SIGTERM'),30000);
child.on('close',code=>{clearTimeout(timeout);process.stdout.write(output);fs.rmSync(directory,{recursive:true,force:true});if(code!==0||!output.includes('CAPTURE_PASS')||/TypeError|ReferenceError|Failed to load|CAPTURE_FAIL/.test(output))process.exitCode=1;});
