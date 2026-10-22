// Optional external-provider smoke test of the actual bounded production bridge.
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
async function live(provider) {
  const child = spawn(process.execPath,[path.resolve(__dirname,'../scripts/ws_bridge.js'),provider,'BTC,ETH,SOL,HYPE']);
  let partial='',ticks=0,passed=false,errors='';
  const timer=setTimeout(()=>{console.error(provider+': no two live projected messages within 15 seconds');child.kill('SIGTERM')},15000);
  child.stderr.on('data',d=>errors+=d);
  child.stdout.on('data',d=>{
    partial+=d;
    for(;;){const end=partial.indexOf('\n');if(end<0)break;const line=partial.slice(0,end);partial=partial.slice(end+1);
      assert.ok(Buffer.byteLength(line+'\n')<=2048);const msg=JSON.parse(line);
      if(msg.type==='ticker'||msg.type==='mids'){
        ticks++;console.log('LIVE',provider,msg.type,JSON.stringify(msg.raw||msg.mids));
        if(ticks>=2){passed=true;clearTimeout(timer);child.stdin.end()}
      }
    }
  });
  await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>{clearTimeout(timer);if(code===0&&passed)resolve();else reject(new Error(provider+': '+errors+' (exit '+code+')'))})});
}
(async()=>{for(const provider of ['binance','coinbase','hyperliquid'])await live(provider);console.log('PASS all three live feeds through bounded production helper')})().catch(e=>{console.error(e);process.exitCode=1});
