const assert = require('node:assert/strict');
const Recovery = require('./load_model')('Recovery');
const Model = require('./load_model')('MarketModel');
let now = 1000000;
const recovery = Recovery.create(() => now);
const calls = [];
const providers = ['binance', 'coinbase', 'hyperliquid', 'yahoo'].map(id => ({
  providerId: id, active: true, targetAssets: id === 'yahoo' ? ['AAPL'] : ['BTC', 'ETH'],
  refresh(force) { calls.push([id, force]); }
}));
const quotes = {};
for (const p of providers) {
  quotes[p.providerId] = {};
  for (const asset of p.targetAssets) quotes[p.providerId][asset] = {
    provider: p.providerId, assetClass: p.providerId === 'yahoo' ? 'stock' : 'crypto',
    price: 100, receivedTimestamp: now, tradingPeriods: null
  };
}
const getQuote = (asset, id) => quotes[id][asset] ? Model.decorateQuote(quotes[id][asset], now) : null;
const tick = () => recovery.tick(providers, getQuote);
tick(); assert.equal(calls.length, 0);
now += 15001;
// Only one Binance instrument goes stale; healthy comparison feeds cannot mask it.
quotes.binance.ETH.receivedTimestamp = now;
quotes.coinbase.BTC.receivedTimestamp = quotes.coinbase.ETH.receivedTimestamp = now;
quotes.hyperliquid.BTC.receivedTimestamp = quotes.hyperliquid.ETH.receivedTimestamp = now;
tick(); assert.deepEqual(calls, [['binance', false]]);
now += 1000; tick(); assert.equal(calls.length, 1);
now += 14000; tick(); assert.equal(calls.filter(c => c[0] === 'binance').length, 2);
// A response recovers freshness immediately, without clearing the displayed value.
quotes.binance.BTC.receivedTimestamp = quotes.binance.ETH.receivedTimestamp = now;
tick(); assert.equal(calls.filter(c => c[0] === 'binance').length, 2);
assert.equal(getQuote('BTC', 'binance').freshness, 'LIVE');
// Manual refresh shares the throttle; outage checks cannot immediately duplicate it.
recovery.record('binance'); delete quotes.binance.BTC;
tick(); assert.equal(calls.filter(c => c[0] === 'binance').length, 2);
now += 15000; tick(); assert.equal(calls.filter(c => c[0] === 'binance').length, 3);
providers[0].active = false;
now += 15000; tick(); assert.equal(calls.filter(c => c[0] === 'binance').length, 3);
// Closed-market equities keep their longer freshness window.
assert.equal(calls.filter(c => c[0] === 'yahoo').length, 0);
now = quotes.yahoo.AAPL.receivedTimestamp + 660001;
tick(); assert.equal(calls.filter(c => c[0] === 'yahoo').length, 1);
console.log('PASS stale feed recovery: per-source/per-asset checks, bounded outage retries, manual throttle, restored freshness, inactive feeds and closed markets');
