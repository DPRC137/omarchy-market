'use strict';

// Only fields consumed by MarketModel cross the helper/shared-shell boundary.
const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_LINE_BYTES = 2048;
const MAX_SYMBOLS = 20;
const MAX_FIELD_CHARS = 40;
const FIELDS = {
  binance: ['s', 'c', 'P', 'h', 'l', 'q', 'b', 'a', 'E'],
  coinbase: ['product_id', 'price', 'open_24h', 'high_24h', 'low_24h', 'volume_24h', 'best_bid', 'best_ask', 'time']
};
function scalar(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  // All retained identifiers, numbers and ISO times are short ASCII strings.
  if (typeof value === 'string' && value.length <= MAX_FIELD_CHARS && /^[A-Za-z0-9.+:TZ_\-]*$/.test(value)) return value;
  return undefined;
}
function ticker(provider, input, symbols) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const suffix = provider === 'binance' ? 'USDT' : '-USD';
  const key = provider === 'binance' ? 's' : 'product_id';
  if (!symbols.some(symbol => input[key] === symbol + suffix)) return null;
  const raw = {};
  for (const field of FIELDS[provider]) {
    const value = scalar(input[field]);
    if (value !== undefined) raw[field] = value;
  }
  return { type: 'ticker', provider, raw };
}
module.exports = { MAX_MESSAGE_BYTES, MAX_LINE_BYTES, MAX_SYMBOLS, ticker, scalar };
