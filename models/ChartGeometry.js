.pragma library

// Native adaptation of TradingView Lightweight Charts' Steffen curve geometry.
// Copyright (c) TradingView, Inc. Licensed under Apache-2.0; see
// third_party/lightweight-charts/LICENSE and NOTICE. Adapted for QML, array
// segment output and explicit validation; no browser/runtime dependency.
// Source: src/renderers/walk-line.ts at
// 82e14e72776fa8b91ab94de0eaac9ab4b0c6c1cd.
function limitedSlope(leftWidth, leftSlope, rightWidth, rightSlope) {
  if (leftWidth <= 0 || rightWidth <= 0) return 0;
  var weighted = (leftSlope * rightWidth + rightSlope * leftWidth) / (leftWidth + rightWidth);
  return (Math.sign(leftSlope) + Math.sign(rightSlope)) *
    Math.min(Math.abs(leftSlope), Math.abs(rightSlope), 0.5 * Math.abs(weighted));
}
function curveSegments(points) {
  if (!points || points.length < 2) return [];
  var slopes = [], widths = [], tangents = [], segments = [];
  for (var i = 0; i < points.length - 1; i++) {
    var width = points[i + 1].x - points[i].x;
    if (!(width > 0)) return [];
    widths.push(width);
    slopes.push((points[i + 1].y - points[i].y) / width);
  }
  tangents[0] = slopes[0];
  tangents[points.length - 1] = slopes[slopes.length - 1];
  for (var j = 1; j < points.length - 1; j++)
    tangents[j] = limitedSlope(widths[j - 1], slopes[j - 1], widths[j], slopes[j]);
  for (var n = 0; n < slopes.length; n++) {
    var start = points[n], end = points[n + 1], step = widths[n] / 3;
    segments.push({ x1:start.x + step, y1:start.y + tangents[n] * step, x2:end.x - step, y2:end.y - tangents[n + 1] * step, x:end.x, y:end.y });
  }
  return segments;
}

// A padded linear price scale with readable 1/2/2.5/5/10 ticks.
function priceScale(low, high) {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high < low)
    return {min:0,max:1,ticks:[],precision:2};
  var padding = high === low ? Math.max(high * 0.02, 1e-10) : (high - low) * 0.10;
  var bottom = Math.max(0,low-padding), top = high+padding;
  var rough = (top-bottom)/5, magnitude = Math.pow(10,Math.floor(Math.log(rough)/Math.LN10));
  var factor = rough/magnitude, nice = factor<=1?1:factor<=2?2:factor<=2.5?2.5:factor<=5?5:10;
  var step = nice*magnitude;
  var first = Math.ceil(bottom/step), last = Math.floor(top/step), ticks=[];
  for(var i=first;i<=last && ticks.length<8;i++)ticks.push(i*step);
  var precision = Math.max(0,-Math.floor(Math.log(step)/Math.LN10));
  if(Math.abs(step*Math.pow(10,precision)-Math.round(step*Math.pow(10,precision)))>1e-6)precision++;
  return {min:bottom,max:top,ticks:ticks,precision:Math.min(10,precision)};
}
