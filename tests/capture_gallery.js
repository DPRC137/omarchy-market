#!/usr/bin/env node
'use strict';
// Public gallery: real data, settled UI, one native card size for every view.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
if (!process.env.WAYLAND_DISPLAY) throw new Error('Gallery capture requires Wayland and Quattro');
const out = path.resolve(process.env.MARKET_CAPTURE_DIR || '/tmp/market-gallery-captures');
fs.mkdirSync(out, {recursive:true});
const directory = fs.mkdtempSync(path.join(os.tmpdir(),'market-gallery-'));
for (const name of ['Commons','Ui']) fs.symlinkSync(`/usr/share/omarchy/shell/${name}`,path.join(directory,name));
fs.symlinkSync(path.resolve(__dirname,'..'),path.join(directory,'market'));
fs.copyFileSync(path.join(__dirname,'gallery_runtime.qml'),path.join(directory,'shell.qml'));
const shots=['watchlist','aapl-month','crypto-week','equity-session','manage','search','manage-actions'];
function run(name) {
  return new Promise((resolve,reject)=>{
    const child=spawn('quickshell',['-p',path.join(directory,'shell.qml')],{env:{...process.env,QT_QPA_PLATFORM:'wayland',QT_QUICK_CONTROLS_STYLE:'Basic',QT_QPA_PLATFORMTHEME:'generic',XDG_CONFIG_HOME:path.join(directory,'config-'+name),MARKET_CAPTURE_DIR:out,MARKET_GALLERY_SHOT:name}});
    let output='',capturing=false,captureError=null;
    function receive(data){
      output+=data;
      const ready=output.match(/GALLERY_READY (\d+) (\d+) (\d+) (\d+)/);
      if(!ready||capturing)return;
      capturing=true;
      // Capture only the real on-screen card after loading and layout settle.
      const shot=spawn('grim',['-g',`${ready[1]},${ready[2]} ${ready[3]}x${ready[4]}`,path.join(out,name+'.png')]);
      shot.on('error',error=>{captureError=error;child.kill('SIGTERM');});
      shot.on('close',code=>{
        if(code!==0){captureError=new Error('grim capture failed: '+code);child.kill('SIGTERM');return;}
        const finish=spawn('quickshell',['ipc','--pid',String(child.pid),'call','market-gallery','captured']);
        finish.on('error',error=>{captureError=error;child.kill('SIGTERM');});
        finish.on('close',code=>{if(code!==0){captureError=new Error('Capture host IPC failed: '+code);child.kill('SIGTERM');}});
      });
    }
    child.stdout.on('data',receive);child.stderr.on('data',receive);
    const timeout=setTimeout(()=>child.kill('SIGTERM'),150000);
    child.on('error',reject);
    child.on('close',code=>{
      clearTimeout(timeout);process.stdout.write(output);
      if(captureError||code!==0||!output.includes('GALLERY_PASS')||/TypeError|ReferenceError|Failed to load|GALLERY_FAIL/.test(output))reject(captureError||new Error('Gallery capture failed: '+name));
      else resolve();
    });
  });
}
(async()=>{
  try {
    // A fresh native host per image avoids carrying focus, scroll or layout state.
    for(const name of shots)await run(name);
    const dimensions=shots.map(name=>{
      const data=fs.readFileSync(path.join(out,name+'.png'));
      return data.readUInt32BE(16)+'x'+data.readUInt32BE(20);
    });
    if(new Set(dimensions).size!==1)throw new Error('Inconsistent screenshot dimensions: '+dimensions);
    console.log('GALLERY_SUITE_PASS: seven settled live captures, all '+dimensions[0]);
  }catch(error){console.error(error);process.exitCode=1;}
  finally{fs.rmSync(directory,{recursive:true,force:true});}
})();
