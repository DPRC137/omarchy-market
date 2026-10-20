'use strict';
const assert = require('node:assert/strict');
const geometry = require('./load_model')('ChartGeometry');
assert.deepEqual(geometry.curveSegments([]),[]);
assert.deepEqual(geometry.curveSegments([{x:1,y:2}]),[]);
assert.deepEqual(geometry.curveSegments([{x:1,y:2},{x:1,y:3}]),[]);
const examples = [
  [{x:0,y:0},{x:1,y:100},{x:2,y:0}],
  [{x:0,y:1},{x:1,y:1},{x:2,y:1}],
  [{x:0,y:0},{x:1,y:100},{x:100,y:101},{x:101,y:0}],
  [{x:0,y:4},{x:100,y:3},{x:101,y:3.5},{x:1000,y:2}],
  Array.from({length:1000},(_,i)=>({x:i,y:Math.sin(i)*100+Math.cos(i*3)*20}))
];
for (const points of examples) {
  const original=JSON.stringify(points);
  const segments=geometry.curveSegments(points);
  assert.equal(segments.length,points.length-1);
  segments.forEach((s,i)=>{
    const start=points[i],end=points[i+1],low=Math.min(start.y,end.y),high=Math.max(start.y,end.y);
    assert.deepEqual({x:s.x,y:s.y},end,'Curve must pass through each actual observation');
    for(const y of [s.y1,s.y2])assert.ok(y>=low-1e-9 && y<=high+1e-9,'Control points invented an extremum');
    assert.ok(s.x1>start.x && s.x2<end.x && s.x1<=s.x2,'Curve doubled back in time');
    for(let step=0;step<=20;step++){
      const t=step/20,u=1-t,y=u*u*u*start.y+3*u*u*t*s.y1+3*u*t*t*s.y2+t*t*t*s.y;
      assert.ok(y>=low-1e-9 && y<=high+1e-9,'Rendered curve overshot an observed interval');
    }
  });
  assert.equal(JSON.stringify(points),original,'Geometry changed source prices');
}
console.log('PASS monotone chart geometry: exact observations, no overshoot, flat/reversing/irregular/dense data and no mutation');
// Steffen slope limiter and Bezier controls match TradingView's renderer.
assert.equal(geometry.limitedSlope(1,1,1,2),1.5);
assert.equal(geometry.limitedSlope(1,1,1,-2),0);
assert.equal(geometry.limitedSlope(1,0,1,2),0);
assert.deepEqual(geometry.curveSegments([{x:0,y:0},{x:3,y:3},{x:6,y:9}]),[
  {x1:1,y1:1,x2:2,y2:1.5,x:3,y:3},
  {x1:4,y1:4.5,x2:5,y2:7,x:6,y:9}
]);
for(const [low,high] of [[328.46,346.6],[100,100],[0.000001,0.000002],[90000,110000]]){
  const scale=geometry.priceScale(low,high);
  assert.ok(scale.min<low && scale.max>high,'Price scale should leave headroom');
  assert.ok(scale.ticks.length>=3 && scale.ticks.length<=8);
  assert.ok(scale.precision>=0 && scale.precision<=10);
}
