#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
let requests = 0;
const server = http.createServer((request,response) => { requests++; response.end(''); });
server.listen(0,'127.0.0.1',()=>{
  const child=spawn(process.execPath,[path.join(__dirname,'run_ui.js'),'security'],{
    env:{...process.env,MARKET_SECURITY_URL:'http://127.0.0.1:'+server.address().port},stdio:'inherit'
  });
  child.on('error',error=>{console.error(error);process.exitCode=1;server.close()});
  child.on('close',code=>{
    try {
      assert.equal(code,0,'Native text-safety test failed');
      assert.equal(requests,0,'Remote rich text triggered a resource load');
      console.log('SECURITY_PASS: hostile image markup caused zero resource requests');
    } catch(error) {console.error(error.message);process.exitCode=1}
    finally {server.close()}
  });
});
