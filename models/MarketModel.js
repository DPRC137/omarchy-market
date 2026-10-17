// MarketModel.js - Core data normalization, instrument catalog, and structured persistence for Omarchy Market

.pragma library

var SCHEMA_VERSION = 2;
var MAX_WATCHLIST_SIZE = 20;

var INSTRUMENT_TYPES = {
  SPOT_LAST: "SPOT_LAST",
  SPOT_BID: "SPOT_BID",
  SPOT_ASK: "SPOT_ASK",
  PERP_MID: "PERP_MID",
  PERP_MARK: "PERP_MARK",
  STOCK_LAST: "STOCK_LAST"
};

var FRESHNESS_THRESHOLDS = {
  LIVE_MS: 15000,    // < 15s is LIVE
  STALE_MS: 60000    // 15s - 60s is STALE, > 60s is OFFLINE
};

// Comprehensive lightweight instrument catalog built from public provider specifications
var INSTRUMENT_CATALOG = [
  // Curated major US Equities
  {
    asset: "AAPL",
    name: "Apple",
    assetClass: "stock",
    instrument: "AAPL_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["aapl", "apple", "apple inc"],
    providers: { yahoo: "AAPL" }
  },
  {
    asset: "MSFT",
    name: "Microsoft",
    assetClass: "stock",
    instrument: "MSFT_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["msft", "microsoft"],
    providers: { yahoo: "MSFT" }
  },
  {
    asset: "NVDA",
    name: "NVIDIA",
    assetClass: "stock",
    instrument: "NVDA_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["nvda", "nvidia"],
    providers: { yahoo: "NVDA" }
  },
  {
    asset: "AMZN",
    name: "Amazon",
    assetClass: "stock",
    instrument: "AMZN_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["amzn", "amazon", "amazon.com"],
    providers: { yahoo: "AMZN" }
  },
  {
    asset: "GOOGL",
    name: "Alphabet",
    assetClass: "stock",
    instrument: "GOOGL_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["googl", "goog", "google", "alphabet"],
    providers: { yahoo: "GOOGL" }
  },
  {
    asset: "META",
    name: "Meta Platforms",
    assetClass: "stock",
    instrument: "META_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["meta", "facebook"],
    providers: { yahoo: "META" }
  },
  {
    asset: "TSLA",
    name: "Tesla",
    assetClass: "stock",
    instrument: "TSLA_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["tsla", "tesla"],
    providers: { yahoo: "TSLA" }
  },
  {
    asset: "AVGO",
    name: "Broadcom",
    assetClass: "stock",
    instrument: "AVGO_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["avgo", "broadcom"],
    providers: { yahoo: "AVGO" }
  },
  {
    asset: "AMD",
    name: "Advanced Micro Devices",
    assetClass: "stock",
    instrument: "AMD_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["amd", "advanced micro devices"],
    providers: { yahoo: "AMD" }
  },
  {
    asset: "NFLX",
    name: "Netflix",
    assetClass: "stock",
    instrument: "NFLX_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["nflx", "netflix"],
    providers: { yahoo: "NFLX" }
  },
  {
    asset: "ORCL",
    name: "Oracle",
    assetClass: "stock",
    instrument: "ORCL_USD_STOCK",
    exchange: "NYSE",
    currency: "USD",
    precision: 2,
    aliases: ["orcl", "oracle"],
    providers: { yahoo: "ORCL" }
  },
  {
    asset: "CRM",
    name: "Salesforce",
    assetClass: "stock",
    instrument: "CRM_USD_STOCK",
    exchange: "NYSE",
    currency: "USD",
    precision: 2,
    aliases: ["crm", "salesforce"],
    providers: { yahoo: "CRM" }
  },
  {
    asset: "ADBE",
    name: "Adobe",
    assetClass: "stock",
    instrument: "ADBE_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["adbe", "adobe"],
    providers: { yahoo: "ADBE" }
  },
  {
    asset: "QCOM",
    name: "Qualcomm",
    assetClass: "stock",
    instrument: "QCOM_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["qcom", "qualcomm"],
    providers: { yahoo: "QCOM" }
  },
  {
    asset: "INTC",
    name: "Intel",
    assetClass: "stock",
    instrument: "INTC_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["intc", "intel"],
    providers: { yahoo: "INTC" }
  },
  {
    asset: "JPM",
    name: "JPMorgan Chase",
    assetClass: "stock",
    instrument: "JPM_USD_STOCK",
    exchange: "NYSE",
    currency: "USD",
    precision: 2,
    aliases: ["jpm", "jpmorgan", "jp morgan", "chase"],
    providers: { yahoo: "JPM" }
  },
  {
    asset: "V",
    name: "Visa",
    assetClass: "stock",
    instrument: "V_USD_STOCK",
    exchange: "NYSE",
    currency: "USD",
    precision: 2,
    aliases: ["v", "visa"],
    providers: { yahoo: "V" }
  },
  {
    asset: "MA",
    name: "Mastercard",
    assetClass: "stock",
    instrument: "MA_USD_STOCK",
    exchange: "NYSE",
    currency: "USD",
    precision: 2,
    aliases: ["ma", "mastercard"],
    providers: { yahoo: "MA" }
  },
  {
    asset: "WMT",
    name: "Walmart",
    assetClass: "stock",
    instrument: "WMT_USD_STOCK",
    exchange: "NYSE",
    currency: "USD",
    precision: 2,
    aliases: ["wmt", "walmart"],
    providers: { yahoo: "WMT" }
  },
  {
    asset: "COST",
    name: "Costco",
    assetClass: "stock",
    instrument: "COST_USD_STOCK",
    exchange: "NASDAQ",
    currency: "USD",
    precision: 2,
    aliases: ["cost", "costco"],
    providers: { yahoo: "COST" }
  },

  // Major Cryptocurrencies
  {
    asset: "BTC",
    name: "Bitcoin",
    assetClass: "crypto",
    instrument: "BTC_USD_SPOT",
    precision: 2,
    aliases: ["btc", "bitcoin", "xbt", "btcusd", "btcusdt"],
    providers: { binance: "BTCUSDT", coinbase: "BTC-USD", hyperliquid: "BTC" }
  },
  {
    asset: "ETH",
    name: "Ethereum",
    assetClass: "crypto",
    instrument: "ETH_USD_SPOT",
    precision: 2,
    aliases: ["eth", "ethereum", "ether", "ethusd", "ethusdt"],
    providers: { binance: "ETHUSDT", coinbase: "ETH-USD", hyperliquid: "ETH" }
  },
  {
    asset: "SOL",
    name: "Solana",
    assetClass: "crypto",
    instrument: "SOL_USD_SPOT",
    precision: 2,
    aliases: ["sol", "solana", "solusd", "solusdt"],
    providers: { binance: "SOLUSDT", coinbase: "SOL-USD", hyperliquid: "SOL" }
  },
  {
    asset: "HYPE",
    name: "Hyperliquid",
    assetClass: "crypto",
    instrument: "HYPE_USDC_PERP",
    precision: 3,
    aliases: ["hype", "hyperliquid"],
    providers: { hyperliquid: "HYPE" }
  },
  {
    asset: "DOGE",
    name: "Dogecoin",
    assetClass: "crypto",
    instrument: "DOGE_USD_SPOT",
    precision: 4,
    aliases: ["doge", "dogecoin", "dogeusd", "dogeusdt"],
    providers: { binance: "DOGEUSDT", coinbase: "DOGE-USD", hyperliquid: "DOGE" }
  },
  {
    asset: "XRP",
    name: "XRP",
    assetClass: "crypto",
    instrument: "XRP_USD_SPOT",
    precision: 4,
    aliases: ["xrp", "ripple", "xrpusd", "xrpusdt"],
    providers: { binance: "XRPUSDT", coinbase: "XRP-USD", hyperliquid: "XRP" }
  },
  {
    asset: "ADA",
    name: "Cardano",
    assetClass: "crypto",
    instrument: "ADA_USD_SPOT",
    precision: 4,
    aliases: ["ada", "cardano", "adausd", "adausdt"],
    providers: { binance: "ADAUSDT", coinbase: "ADA-USD", hyperliquid: "ADA" }
  },
  {
    asset: "AVAX",
    name: "Avalanche",
    assetClass: "crypto",
    instrument: "AVAX_USD_SPOT",
    precision: 2,
    aliases: ["avax", "avalanche", "avaxusd", "avaxusdt"],
    providers: { binance: "AVAXUSDT", coinbase: "AVAX-USD", hyperliquid: "AVAX" }
  },
  {
    asset: "SUI",
    name: "Sui",
    assetClass: "crypto",
    instrument: "SUI_USD_SPOT",
    precision: 3,
    aliases: ["sui", "suiusd", "suiusdt"],
    providers: { binance: "SUIUSDT", coinbase: "SUI-USD", hyperliquid: "SUI" }
  },
  {
    asset: "LINK",
    name: "Chainlink",
    assetClass: "crypto",
    instrument: "LINK_USD_SPOT",
    precision: 2,
    aliases: ["link", "chainlink", "linkusd", "linkusdt"],
    providers: { binance: "LINKUSDT", coinbase: "LINK-USD", hyperliquid: "LINK" }
  },
  {
    asset: "NEAR",
    name: "NEAR Protocol",
    assetClass: "crypto",
    instrument: "NEAR_USD_SPOT",
    precision: 3,
    aliases: ["near", "near protocol", "nearusd", "nearusdt"],
    providers: { binance: "NEARUSDT", coinbase: "NEAR-USD", hyperliquid: "NEAR" }
  },
  {
    asset: "BNB",
    name: "BNB",
    assetClass: "crypto",
    instrument: "BNB_USD_SPOT",
    precision: 2,
    aliases: ["bnb", "binance coin", "bnbusdt"],
    providers: { binance: "BNBUSDT", hyperliquid: "BNB" }
  },
  {
    asset: "DOT",
    name: "Polkadot",
    assetClass: "crypto",
    instrument: "DOT_USD_SPOT",
    precision: 3,
    aliases: ["dot", "polkadot", "dotusd", "dotusdt"],
    providers: { binance: "DOTUSDT", coinbase: "DOT-USD", hyperliquid: "DOT" }
  },
  {
    asset: "LTC",
    name: "Litecoin",
    assetClass: "crypto",
    instrument: "LTC_USD_SPOT",
    precision: 2,
    aliases: ["ltc", "litecoin", "ltcusd", "ltcusdt"],
    providers: { binance: "LTCUSDT", coinbase: "LTC-USD", hyperliquid: "LTC" }
  },
  {
    asset: "BCH",
    name: "Bitcoin Cash",
    assetClass: "crypto",
    instrument: "BCH_USD_SPOT",
    precision: 2,
    aliases: ["bch", "bitcoin cash", "bchusd", "bchusdt"],
    providers: { binance: "BCHUSDT", coinbase: "BCH-USD", hyperliquid: "BCH" }
  },
  {
    asset: "UNI",
    name: "Uniswap",
    assetClass: "crypto",
    instrument: "UNI_USD_SPOT",
    precision: 3,
    aliases: ["uni", "uniswap", "uniusd", "uniusdt"],
    providers: { binance: "UNIUSDT", coinbase: "UNI-USD", hyperliquid: "UNI" }
  },
  {
    asset: "APT",
    name: "Aptos",
    assetClass: "crypto",
    instrument: "APT_USD_SPOT",
    precision: 3,
    aliases: ["apt", "aptos", "aptusd", "aptusdt"],
    providers: { binance: "APTUSDT", coinbase: "APT-USD", hyperliquid: "APT" }
  },
  {
    asset: "PEPE",
    name: "Pepe",
    assetClass: "crypto",
    instrument: "PEPE_USD_SPOT",
    precision: 8,
    aliases: ["pepe", "pepeusd", "pepeusdt"],
    providers: { binance: "PEPEUSDT", hyperliquid: "PEPE" }
  },
  {
    asset: "SHIB",
    name: "Shiba Inu",
    assetClass: "crypto",
    instrument: "SHIB_USD_SPOT",
    precision: 6,
    aliases: ["shib", "shiba", "shiba inu", "shibusd", "shibusdt"],
    providers: { binance: "SHIBUSDT", coinbase: "SHIB-USD", hyperliquid: "SHIB" }
  },
  {
    asset: "ARB",
    name: "Arbitrum",
    assetClass: "crypto",
    instrument: "ARB_USD_SPOT",
    precision: 4,
    aliases: ["arb", "arbitrum", "arbusd", "arbusdt"],
    providers: { binance: "ARBUSDT", coinbase: "ARB-USD", hyperliquid: "ARB" }
  },
  {
    asset: "OP",
    name: "Optimism",
    assetClass: "crypto",
    instrument: "OP_USD_SPOT",
    precision: 4,
    aliases: ["op", "optimism", "opusd", "opusdt"],
    providers: { binance: "OPUSDT", coinbase: "OP-USD", hyperliquid: "OP" }
  },
  {
    asset: "RENDER",
    name: "Render",
    assetClass: "crypto",
    instrument: "RENDER_USD_SPOT",
    precision: 3,
    aliases: ["render", "rndr", "renderusd", "renderusdt"],
    providers: { binance: "RENDERUSDT", coinbase: "RENDER-USD", hyperliquid: "RENDER" }
  },
  {
    asset: "AAVE",
    name: "Aave",
    assetClass: "crypto",
    instrument: "AAVE_USD_SPOT",
    precision: 2,
    aliases: ["aave", "aaveusd", "aaveusdt"],
    providers: { binance: "AAVEUSDT", coinbase: "AAVE-USD", hyperliquid: "AAVE" }
  },
  {
    asset: "POL",
    name: "Polygon",
    assetClass: "crypto",
    instrument: "POL_USD_SPOT",
    precision: 4,
    aliases: ["pol", "polygon", "matic", "polusd", "polusdt"],
    providers: { binance: "POLUSDT", coinbase: "POL-USD", hyperliquid: "POL" }
  },
  {
    asset: "ATOM",
    name: "Cosmos",
    assetClass: "crypto",
    instrument: "ATOM_USD_SPOT",
    precision: 3,
    aliases: ["atom", "cosmos", "atomusd", "atomusdt"],
    providers: { binance: "ATOMUSDT", coinbase: "ATOM-USD", hyperliquid: "ATOM" }
  },
  {
    asset: "INJ",
    name: "Injective",
    assetClass: "crypto",
    instrument: "INJ_USD_SPOT",
    precision: 3,
    aliases: ["inj", "injective", "injusd", "injusdt"],
    providers: { binance: "INJUSDT", coinbase: "INJ-USD", hyperliquid: "INJ" }
  },
  {
    asset: "FIL",
    name: "Filecoin",
    assetClass: "crypto",
    instrument: "FIL_USD_SPOT",
    precision: 3,
    aliases: ["fil", "filecoin", "filusd", "filusdt"],
    providers: { binance: "FILUSDT", coinbase: "FIL-USD", hyperliquid: "FIL" }
  },
  {
    asset: "TIA",
    name: "Celestia",
    assetClass: "crypto",
    instrument: "TIA_USD_SPOT",
    precision: 3,
    aliases: ["tia", "celestia", "tiausd", "tiausdt"],
    providers: { binance: "TIAUSDT", coinbase: "TIA-USD", hyperliquid: "TIA" }
  },
  {
    asset: "SEI",
    name: "Sei",
    assetClass: "crypto",
    instrument: "SEI_USD_SPOT",
    precision: 4,
    aliases: ["sei", "seiusd", "seiusdt"],
    providers: { binance: "SEIUSDT", coinbase: "SEI-USD", hyperliquid: "SEI" }
  },
  {
    asset: "XLM",
    name: "Stellar",
    assetClass: "crypto",
    instrument: "XLM_USD_SPOT",
    precision: 4,
    aliases: ["xlm", "stellar", "lumens", "xlmusd", "xlmusdt"],
    providers: { binance: "XLMUSDT", coinbase: "XLM-USD", hyperliquid: "XLM" }
  },
  {
    asset: "ALGO",
    name: "Algorand",
    assetClass: "crypto",
    instrument: "ALGO_USD_SPOT",
    precision: 4,
    aliases: ["algo", "algorand", "algousd", "algousdt"],
    providers: { binance: "ALGOUSDT", coinbase: "ALGO-USD", hyperliquid: "ALGO" }
  },
  {
    asset: "ICP",
    name: "Internet Computer",
    assetClass: "crypto",
    instrument: "ICP_USD_SPOT",
    precision: 3,
    aliases: ["icp", "internet computer", "icpusd", "icpusdt"],
    providers: { binance: "ICPUSDT", coinbase: "ICP-USD", hyperliquid: "ICP" }
  },
  {
    asset: "KAS",
    name: "Kaspa",
    assetClass: "crypto",
    instrument: "KAS_USD_SPOT",
    precision: 4,
    aliases: ["kas", "kaspa", "kasusdt"],
    providers: { binance: "KASUSDT", hyperliquid: "KAS" }
  },
  {
    asset: "CRV",
    name: "Curve DAO",
    assetClass: "crypto",
    instrument: "CRV_USD_SPOT",
    precision: 4,
    aliases: ["crv", "curve", "crvusd", "crvusdt"],
    providers: { binance: "CRVUSDT", coinbase: "CRV-USD", hyperliquid: "CRV" }
  },
  {
    asset: "ENA",
    name: "Ethena",
    assetClass: "crypto",
    instrument: "ENA_USD_SPOT",
    precision: 4,
    aliases: ["ena", "ethena", "enausd", "enausdt"],
    providers: { binance: "ENAUSDT", coinbase: "ENA-USD", hyperliquid: "ENA" }
  },
  {
    asset: "WLD",
    name: "Worldcoin",
    assetClass: "crypto",
    instrument: "WLD_USD_SPOT",
    precision: 3,
    aliases: ["wld", "worldcoin", "wldusdt"],
    providers: { binance: "WLDUSDT", hyperliquid: "WLD" }
  },
  {
    asset: "ONDO",
    name: "Ondo Finance",
    assetClass: "crypto",
    instrument: "ONDO_USD_SPOT",
    precision: 4,
    aliases: ["ondo", "ondousd", "ondousdt"],
    providers: { binance: "ONDOUSDT", coinbase: "ONDO-USD", hyperliquid: "ONDO" }
  },
  {
    asset: "TAO",
    name: "Bittensor",
    assetClass: "crypto",
    instrument: "TAO_USD_SPOT",
    precision: 2,
    aliases: ["tao", "bittensor", "taousdt"],
    providers: { binance: "TAOUSDT", hyperliquid: "TAO" }
  },
  {
    asset: "FET",
    name: "Artificial Superintelligence",
    assetClass: "crypto",
    instrument: "FET_USD_SPOT",
    precision: 4,
    aliases: ["fet", "fetch", "fetch.ai", "asi", "fetusd", "fetusdt"],
    providers: { binance: "FETUSDT", coinbase: "FET-USD", hyperliquid: "FET" }
  }
];

// Build fast lookup index by asset
var CATALOG_BY_ASSET = {};
for (var i = 0; i < INSTRUMENT_CATALOG.length; i++) {
  var item = INSTRUMENT_CATALOG[i];
  CATALOG_BY_ASSET[item.asset] = item;
}

// Backward-compatible ASSET_DEFINITIONS dictionary
var ASSET_DEFINITIONS = {};
for (var a in CATALOG_BY_ASSET) {
  var c = CATALOG_BY_ASSET[a];
  ASSET_DEFINITIONS[a] = {
    name: c.name,
    symbol: c.asset,
    baseCurrency: "USD",
    precision: c.precision,
    icon: "",
    assetClass: c.assetClass || "crypto"
  };
}

var DEFAULT_ASSETS = ["BTC", "ETH", "SOL", "HYPE"];

var DYNAMIC_SYMBOL_REGEX = /^[A-Z0-9.\-]{1,24}$/;

function toFiniteNumber(val, fallback) {
  var def = (typeof fallback === "number" && Number.isFinite(fallback)) ? fallback : 0;
  if (val === null || val === undefined) return def;
  var n = Number(val);
  return Number.isFinite(n) ? n : def;
}

function canonicalizeDynamicStock(item) {
  if (!item || typeof item !== "object") return null;
  var rawAsset = (typeof item.asset === "string") ? item.asset : (typeof item.symbol === "string" ? item.symbol : "");
  var sym = rawAsset.trim().toUpperCase();
  if (!sym || !DYNAMIC_SYMBOL_REGEX.test(sym)) {
    return null;
  }

  // Name: require a string when supplied, trim it, fall back to the symbol when absent, cap at 100 characters
  var name = sym;
  if (typeof item.name === "string" && item.name.trim()) {
    name = item.name.trim().slice(0, 100);
  }

  // Precision: integer only, clamp to 0..8, default 2
  var precision = 2;
  if (typeof item.precision === "number" && Number.isFinite(item.precision)) {
    var pInt = Math.round(item.precision);
    precision = Math.max(0, Math.min(8, pInt));
  }

  // Exchange: string only, trim, cap at 30 chars, default "US"
  var exchange = "US";
  if (typeof item.exchange === "string" && item.exchange.trim()) {
    exchange = item.exchange.trim().slice(0, 30);
  }

  // Canonicalize without allowing persisted/remote inputs to override provider symbol or instrument identity:
  // instrument = sym + "_USD_STOCK"
  // providers = { yahoo: sym }
  // aliases = [sym.toLowerCase()]
  return {
    asset: sym,
    name: name,
    assetClass: "stock",
    instrument: sym + "_" + (validCurrency(item.currency) || "UNKNOWN") + "_STOCK",
    currency: validCurrency(item.currency),
    exchange: exchange,
    precision: precision,
    aliases: [sym.toLowerCase()],
    providers: { yahoo: sym }
  };
}

// Dynamic instrument registry for discovered stocks (separate from static catalog)
var DYNAMIC_INSTRUMENTS = {};

function registerDynamicInstrument(item) {
  var validated = canonicalizeDynamicStock(item);
  if (!validated) return null;
  DYNAMIC_INSTRUMENTS[validated.asset] = validated;
  return validated;
}

function clearDynamicInstruments() {
  DYNAMIC_INSTRUMENTS = {};
}

function getCatalogItem(assetOrQuery) {
  if (!assetOrQuery) return null;
  var q = String(assetOrQuery).trim();
  var upper = q.toUpperCase();
  if (CATALOG_BY_ASSET[upper]) return CATALOG_BY_ASSET[upper];
  if (DYNAMIC_INSTRUMENTS[upper]) return DYNAMIC_INSTRUMENTS[upper];

  var lower = q.toLowerCase();
  for (var i = 0; i < INSTRUMENT_CATALOG.length; i++) {
    var item = INSTRUMENT_CATALOG[i];
    if (item.asset.toLowerCase() === lower || item.name.toLowerCase() === lower) {
      return item;
    }
    if (item.aliases && Array.isArray(item.aliases)) {
      for (var k = 0; k < item.aliases.length; k++) {
        if (item.aliases[k] === lower) return item;
      }
    }
  }

  for (var dynSym in DYNAMIC_INSTRUMENTS) {
    var dynItem = DYNAMIC_INSTRUMENTS[dynSym];
    if (dynItem.asset.toLowerCase() === lower || dynItem.name.toLowerCase() === lower) {
      return dynItem;
    }
  }
  return null;
}

function searchCatalog(query) {
  if (!query) return [];
  var raw = String(query).trim().toLowerCase();
  if (raw.length === 0) return [];

  var exactMatches = [];
  var prefixMatches = [];
  var substringMatches = [];

  for (var i = 0; i < INSTRUMENT_CATALOG.length; i++) {
    var item = INSTRUMENT_CATALOG[i];
    var symLower = item.asset.toLowerCase();
    var nameLower = item.name.toLowerCase();

    // Check exact matches
    if (symLower === raw || nameLower === raw) {
      exactMatches.push(item);
      continue;
    }

    var isAliasExact = false;
    if (item.aliases) {
      for (var a = 0; a < item.aliases.length; a++) {
        if (item.aliases[a] === raw) {
          exactMatches.push(item);
          isAliasExact = true;
          break;
        }
      }
    }
    if (isAliasExact) continue;

    // Check prefix matches
    if (symLower.indexOf(raw) === 0 || nameLower.indexOf(raw) === 0) {
      prefixMatches.push(item);
      continue;
    }

    var isAliasPrefix = false;
    if (item.aliases) {
      for (var b = 0; b < item.aliases.length; b++) {
        if (item.aliases[b].indexOf(raw) === 0) {
          prefixMatches.push(item);
          isAliasPrefix = true;
          break;
        }
      }
    }
    if (isAliasPrefix) continue;

    // Check substring matches
    if (symLower.indexOf(raw) !== -1 || nameLower.indexOf(raw) !== -1 || (item.assetClass && (raw === "stock" || raw === "stocks" || raw === "equity" || raw === "equities") && item.assetClass === "stock") || (item.assetClass && (raw === "crypto" || raw === "cryptos" || raw === "coin" || raw === "coins") && item.assetClass === "crypto")) {
      substringMatches.push(item);
      continue;
    }

    if (item.aliases) {
      for (var c = 0; c < item.aliases.length; c++) {
        if (item.aliases[c].indexOf(raw) !== -1) {
          substringMatches.push(item);
          break;
        }
      }
    }
  }

  var combined = exactMatches.concat(prefixMatches).concat(substringMatches);
  return combined.slice(0, 8);
}

function isValidMarket(assetOrQuery) {
  return getCatalogItem(assetOrQuery) !== null;
}

// Watchlist structured persistence & migration

function createDefaultWatchlist() {
  var defaultItems = [];
  for (var i = 0; i < DEFAULT_ASSETS.length; i++) {
    var item = getCatalogItem(DEFAULT_ASSETS[i]);
    if (item) {
      defaultItems.push({
        asset: item.asset,
        name: item.name,
        instrument: item.instrument,
        precision: item.precision,
        assetClass: item.assetClass || "crypto",
        providers: Object.assign({}, item.providers)
      });
    }
  }
  return {
    version: SCHEMA_VERSION,
    items: defaultItems
  };
}

function serializeWatchlist(watchlistObj) {
  if (!watchlistObj || !Array.isArray(watchlistObj.items)) {
    return JSON.stringify(createDefaultWatchlist());
  }
  return JSON.stringify(watchlistObj);
}

function deserializeWatchlist(rawString) {
  if (!rawString || typeof rawString !== "string" || !rawString.trim()) {
    return createDefaultWatchlist();
  }

  var parsed;
  try {
    parsed = JSON.parse(rawString);
  } catch (e) {
    console.warn("deserializeWatchlist: Malformed JSON, restoring default watchlist", e);
    return createDefaultWatchlist();
  }

  // Handle migration from legacy bare string array: ["BTC", "ETH", "SOL", "HYPE"]
  if (Array.isArray(parsed)) {
    var migratedItems = [];
    var seenAssets = {};
    for (var i = 0; i < parsed.length; i++) {
      var sym = String(parsed[i] || "").trim().toUpperCase();
      if (!sym || seenAssets[sym]) continue;
      var cat = getCatalogItem(sym);
      if (cat) {
        seenAssets[sym] = true;
        migratedItems.push({
          asset: cat.asset,
          name: cat.name,
          instrument: cat.instrument,
          precision: cat.precision,
          assetClass: cat.assetClass || "crypto",
          providers: Object.assign({}, cat.providers)
        });
      }
      if (migratedItems.length >= MAX_WATCHLIST_SIZE) break;
    }
    if (migratedItems.length === 0) return createDefaultWatchlist();
    return {
      version: SCHEMA_VERSION,
      items: migratedItems
    };
  }

  // Handle structured watchlist object
  if (parsed && typeof parsed === "object") {
    var items = Array.isArray(parsed.items) ? parsed.items : [];
    var cleanItems = [];
    var seen = {};

    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      if (!it || typeof it !== "object") continue;
      var rawAsset = (typeof it.asset === "string") ? it.asset : (typeof it.symbol === "string" ? it.symbol : "");
      var assetKey = rawAsset.trim().toUpperCase();
      if (!assetKey || seen[assetKey]) continue;

      var catalogEntry = getCatalogItem(assetKey);
      if (!catalogEntry && it.assetClass === "stock") {
        catalogEntry = registerDynamicInstrument(it);
      }
      if (!catalogEntry) continue; // Discard invalid dynamic entries

      seen[assetKey] = true;
      cleanItems.push({
        asset: catalogEntry.asset,
        name: (catalogEntry.assetClass === "stock" && typeof it.name === "string" && it.name.trim()) ? it.name.trim().slice(0, 100) : catalogEntry.name,
        instrument: catalogEntry.instrument,
        precision: catalogEntry.precision,
        currency: catalogEntry.currency || null,
        exchange: catalogEntry.exchange,
        assetClass: catalogEntry.assetClass || "crypto",
        providers: Object.assign({}, catalogEntry.providers)
      });

      if (cleanItems.length >= MAX_WATCHLIST_SIZE) break;
    }

    if (cleanItems.length === 0) {
      return createDefaultWatchlist();
    }

    return {
      version: SCHEMA_VERSION,
      items: cleanItems
    };
  }

  return createDefaultWatchlist();
}

function addWatchlistMarket(watchlistObj, assetOrItem) {
  var current = (watchlistObj && Array.isArray(watchlistObj.items)) ? watchlistObj : createDefaultWatchlist();
  if (current.items.length >= MAX_WATCHLIST_SIZE) {
    return { success: false, reason: "MAX_LIMIT", watchlist: current };
  }

  var targetAsset = (typeof assetOrItem === "object" && assetOrItem && typeof assetOrItem.asset === "string") ? assetOrItem.asset : (typeof assetOrItem === "string" ? assetOrItem : "");
  var cleanTarget = targetAsset.trim().toUpperCase();
  var catalogItem = getCatalogItem(cleanTarget);
  if (!catalogItem && typeof assetOrItem === "object" && assetOrItem) {
    catalogItem = registerDynamicInstrument(assetOrItem);
  } else if (!catalogItem && typeof assetOrItem === "string" && cleanTarget) {
    catalogItem = registerDynamicInstrument({ asset: cleanTarget });
  }
  if (!catalogItem) {
    return { success: false, reason: "INVALID_MARKET", watchlist: current };
  }

  // Check duplicates
  for (var i = 0; i < current.items.length; i++) {
    if (current.items[i].asset === catalogItem.asset) {
      return { success: false, reason: "DUPLICATE", watchlist: current };
    }
  }

  var nextItems = current.items.slice();
  nextItems.push({
    asset: catalogItem.asset,
    name: catalogItem.name,
    instrument: catalogItem.instrument,
    precision: catalogItem.precision,
    currency: catalogItem.currency || null,
    exchange: catalogItem.exchange,
    assetClass: catalogItem.assetClass || "crypto",
    providers: Object.assign({}, catalogItem.providers)
  });

  return {
    success: true,
    watchlist: {
      version: SCHEMA_VERSION,
      items: nextItems
    }
  };
}

function removeWatchlistMarket(watchlistObj, asset) {
  var current = (watchlistObj && Array.isArray(watchlistObj.items)) ? watchlistObj : createDefaultWatchlist();
  var sym = String(asset || "").trim().toUpperCase();

  if (current.items.length <= 1) {
    return { success: false, reason: "MIN_LIMIT", watchlist: current };
  }

  var filtered = current.items.filter(function(it) {
    return it.asset !== sym;
  });

  if (filtered.length === current.items.length) {
    return { success: false, reason: "NOT_FOUND", watchlist: current };
  }

  return {
    success: true,
    watchlist: {
      version: SCHEMA_VERSION,
      items: filtered
    }
  };
}

function reorderWatchlistMarket(watchlistObj, fromIndex, toIndex) {
  var current = (watchlistObj && Array.isArray(watchlistObj.items)) ? watchlistObj : createDefaultWatchlist();
  var items = current.items.slice();

  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
    return { success: false, reason: "OUT_OF_BOUNDS", watchlist: current };
  }
  if (fromIndex === toIndex) {
    return { success: true, watchlist: current };
  }

  var moved = items.splice(fromIndex, 1)[0];
  items.splice(toIndex, 0, moved);

  return {
    success: true,
    watchlist: {
      version: SCHEMA_VERSION,
      items: items
    }
  };
}

function createEmptyQuote(asset, provider) {
  var cat = getCatalogItem(asset) || { name: asset, symbol: asset, precision: 2, icon: "", assetClass: "crypto" };
  var prov = !provider || provider === "aggregate" ? selectedProvider(asset) : provider;
  var isStock = (cat.assetClass === "stock" || (cat.instrument && cat.instrument.indexOf("STOCK") !== -1));
  var isPerp = (!isStock && (asset === "HYPE" || prov === "hyperliquid" || (cat.instrument && cat.instrument.indexOf("PERP") !== -1)));

  var currency = isStock ? (cat.currency || null) : isPerp ? (asset === "HYPE" ? "USDC" : "USDT") : prov === "binance" ? "USDT" : "USD";
  var inst = isStock ? (asset + "_" + (cat.currency || "UNKNOWN") + "_STOCK") : (isPerp ? (asset + "_" + currency + "_PERP") : (asset + (prov === "binance" ? "_USDT_SPOT" : "_USD_SPOT")));
  var pType = isStock ? INSTRUMENT_TYPES.STOCK_LAST : (isPerp ? INSTRUMENT_TYPES.PERP_MARK : INSTRUMENT_TYPES.SPOT_LAST);

  return {
    asset: asset,
    instrument: inst,
    priceType: pType,
    name: cat.name,
    icon: "",
    symbol: isStock ? asset : (asset + "/" + currency),
    provider: prov,
    currency: currency,
    volumeUnit: isStock ? "shares" : currency,
    exchange: providerDisplayName(prov),
    price: null,
    change24h: null,
    changePercent24h: null,
    changeAmount: null,
    previousClose: null,
    open: null,
    high24h: null,
    low24h: null,
    volume24h: null,
    bid: null,
    ask: null,
    spread: null,
    providerTimestamp: 0,
    receivedTimestamp: 0,
    freshness: "UNAVAILABLE",
    assetClass: isStock ? "stock" : "crypto",
    marketState: "unknown"
  };
}

function providerDisplayName(id) {
  if (id === "binance") return "Binance";
  if (id === "coinbase") return "Coinbase";
  if (id === "hyperliquid") return "Hyperliquid";
  if (id === "yahoo") return "Yahoo Finance";
  if (id === "aggregate") return "Reference Spot";
  return id || "Unknown";
}

function getFreshness(receivedTimestamp, now) {
  var current = now || Date.now();
  if (!receivedTimestamp || receivedTimestamp <= 0) return "OFFLINE";
  var diff = current - receivedTimestamp;
  if (diff < FRESHNESS_THRESHOLDS.LIVE_MS) return "LIVE";
  if (diff < FRESHNESS_THRESHOLDS.STALE_MS) return "STALE";
  return "OFFLINE";
}

// Dynamic symbol inference from provider ticker strings
function inferAssetFromBinanceSymbol(symbol) {
  if (!symbol) return "";
  var s = String(symbol).toUpperCase();
  if (s.endsWith("USDT")) return s.slice(0, -4);
  if (s.endsWith("USD")) return s.slice(0, -3);
  if (s.endsWith("BUSD")) return s.slice(0, -4);
  return s;
}

function inferAssetFromCoinbaseProduct(productId) {
  if (!productId) return "";
  var parts = String(productId).toUpperCase().split("-");
  return parts[0] || "";
}

// Normalizes Binance 24hr ticker websocket or REST payload
function normalizeBinanceTicker(data, now) {
  if (!data) return null;
  var symbol = String(data.s || data.symbol || "");
  var asset = inferAssetFromBinanceSymbol(symbol);
  if (!asset) return null;

  var cat = getCatalogItem(asset);
  if (!cat || !cat.providers || cat.providers.binance !== symbol) return null;

  var price = optionalNumber(data.c !== undefined ? data.c : data.lastPrice);
  if (!(price > 0)) return null;
  var change24h = optionalNumber(data.P !== undefined ? data.P : data.priceChangePercent);
  var high24h = optionalNumber(data.h !== undefined ? data.h : data.highPrice);
  var low24h = optionalNumber(data.l !== undefined ? data.l : data.lowPrice);
  var volume24h = optionalNumber(data.q !== undefined ? data.q : data.quoteVolume);
  var bid = optionalNumber(data.b !== undefined ? data.b : data.bidPrice);
  var ask = optionalNumber(data.a !== undefined ? data.a : data.askPrice);
  var recTime = now || Date.now();
  var eventTime = toFiniteNumber(data.E || data.closeTime, recTime);

  return {
    asset: asset,
    instrument: asset + "_USDT_SPOT",
    currency: "USDT",
    volumeUnit: "USDT",
    priceType: INSTRUMENT_TYPES.SPOT_LAST,
    name: cat.name,
    icon: "",
    symbol: asset + "/USDT",
    provider: "binance",
    exchange: "Binance",
    price: price,
    change24h: change24h,
    changePercent24h: change24h,
    changeAmount: 0,
    previousClose: 0,
    open: 0,
    high24h: high24h,
    low24h: low24h,
    volume24h: volume24h,
    bid: bid,
    ask: ask,
    spread: (bid > 0 && ask >= bid) ? (ask - bid) : 0,
    providerTimestamp: eventTime,
    receivedTimestamp: recTime,
    freshness: "LIVE",
    assetClass: "crypto",
    marketState: "regular"
  };
}

// Normalizes Coinbase Advanced Trade / Exchange ticker payload
function normalizeCoinbaseTicker(data, now) {
  if (!data || (data.type && data.type !== "ticker")) return null;
  var prod = String(data.product_id || "");
  var asset = inferAssetFromCoinbaseProduct(prod);
  if (!asset) return null;

  var cat = getCatalogItem(asset);
  if (!cat || !cat.providers || cat.providers.coinbase !== prod) return null;

  var price = toFiniteNumber(data.price, 0);
  var open24h = toFiniteNumber(data.open_24h, 0);
  if (!(price > 0)) return null;
  var change24h = null;
  if (open24h > 0 && price > 0) {
    change24h = ((price - open24h) / open24h) * 100;
  }

  var high24h = optionalNumber(data.high_24h);
  var low24h = optionalNumber(data.low_24h);
  var volume24h = optionalNumber(data.volume_24h);
  var bid = toFiniteNumber(data.best_bid, 0);
  var ask = toFiniteNumber(data.best_ask, 0);
  var recTime = now || Date.now();
  var eventTime = data.time ? Date.parse(data.time) : recTime;
  eventTime = toFiniteNumber(eventTime, recTime);

  return {
    asset: asset,
    instrument: asset + "_USD_SPOT",
    currency: "USD",
    volumeUnit: asset,
    priceType: INSTRUMENT_TYPES.SPOT_LAST,
    name: cat.name,
    icon: "",
    symbol: asset + "/USD",
    provider: "coinbase",
    exchange: "Coinbase",
    price: price,
    change24h: change24h,
    changePercent24h: change24h,
    changeAmount: 0,
    previousClose: open24h,
    open: open24h,
    high24h: high24h,
    low24h: low24h,
    volume24h: volume24h,
    bid: bid,
    ask: ask,
    spread: (bid > 0 && ask >= bid) ? (ask - bid) : 0,
    providerTimestamp: eventTime,
    receivedTimestamp: recTime,
    freshness: "LIVE",
    assetClass: "crypto",
    marketState: "regular"
  };
}

// Normalizes Hyperliquid metaAndAssetCtxs payload
function normalizeHyperliquidMeta(data, targetAssets, now) {
  if (!data || !Array.isArray(data) || data.length < 2) return [];
  var universe = data[0].universe;
  var ctxs = data[1];
  if (!Array.isArray(universe) || !Array.isArray(ctxs)) return [];

  var targets = targetAssets || DEFAULT_ASSETS;
  var results = [];
  var recTime = now || Date.now();

  for (var i = 0; i < universe.length; i++) {
    var meta = universe[i];
    if (!meta || !meta.name) continue;
    var name = String(meta.name).toUpperCase();
    if (targets.indexOf(name) === -1) continue;

    var ctx = ctxs[i];
    if (!ctx) continue;

    var cat = getCatalogItem(name);
    var price = toFiniteNumber(ctx.markPx, 0);
    if (!(price > 0)) continue;
    var prevDay = toFiniteNumber(ctx.prevDayPx, 0);
    var change24h = null;
    if (prevDay > 0 && price > 0) {
      change24h = ((price - prevDay) / prevDay) * 100;
    }

    // Contract denomination differs from collateral. HYPE is USDC-priced;
    // other supported crypto contracts use USDT with USDC collateral.
    var currency = name === "HYPE" ? "USDC" : "USDT";
    var volume24h = optionalNumber(ctx.dayNtlVlm);

    results.push({
      asset: name,
      instrument: name + "_" + currency + "_PERP",
      currency: currency,
      collateralCurrency: "USDC",
      volumeUnit: currency + " notional",
      priceType: INSTRUMENT_TYPES.PERP_MARK,
      name: cat ? cat.name : name,
      icon: "",
      symbol: name + "/" + currency,
      provider: "hyperliquid",
      exchange: "Hyperliquid",
      price: isNaN(price) ? 0 : price,
      change24h: change24h,
      changePercent24h: change24h,
      changeAmount: 0,
      previousClose: prevDay,
      open: prevDay,
      high24h: null,
      low24h: null,
      volume24h: volume24h,
      bid: null,
      ask: null,
      spread: null,
      providerTimestamp: recTime,
      receivedTimestamp: recTime,
      freshness: "LIVE",
      assetClass: "crypto",
      marketState: "regular"
    });
  }

  return results;
}

// Yahoo headlines always use regular-session prices, including while the
// exchange is in pre/post-market. Session status is independently clock-driven.
function normalizeYahooChart(data, now) {
  var result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result || !result.meta) return null;
  var meta = result.meta;
  var asset = String(meta.symbol || "").toUpperCase();
  var cat = getCatalogItem(asset);
  var currency = validCurrency(meta.currency);
  if (!cat || cat.assetClass !== "stock" || !currency) return null;
  var recTime = now === undefined ? Date.now() : now;
  var bars = result.indicators && result.indicators.quote && result.indicators.quote[0] || {};
  var times = result.timestamp || [];
  var price = optionalNumber(meta.regularMarketPrice);
  var eventTime = optionalNumber(meta.regularMarketTime);
  if (!(price > 0)) {
    for (var i = times.length - 1; i >= 0; i--) {
      var close = optionalNumber((bars.close || [])[i]);
      if (close > 0) { price = close; eventTime = times[i]; break; }
    }
  }
  if (!(price > 0)) return null;
  var previous = optionalNumber(meta.previousClose || meta.chartPreviousClose);
  var change = previous > 0 ? price - previous : null;
  var high = optionalNumber(meta.regularMarketDayHigh);
  var low = optionalNumber(meta.regularMarketDayLow);
  var volume = optionalNumber(meta.regularMarketVolume);
  var open = optionalNumber(meta.regularMarketOpen);
  var period = meta.currentTradingPeriod && meta.currentTradingPeriod.regular;
  var sessionVolumes = [];
  if (period) {
    for (var j = 0; j < times.length; j++) {
      if (times[j] < period.start || times[j] >= period.end) continue;
      var h = optionalNumber((bars.high || [])[j]);
      var l = optionalNumber((bars.low || [])[j]);
      var v = optionalNumber((bars.volume || [])[j]);
      if (!open) open = optionalNumber((bars.open || [])[j]);
      if (!(meta.regularMarketDayHigh > 0) && h > 0) high = high === null ? h : Math.max(high, h);
      if (!(meta.regularMarketDayLow > 0) && l > 0) low = low === null ? l : Math.min(low, l);
      if (v !== null) sessionVolumes.push(v);
    }
  }
  if (volume === null && sessionVolumes.length) volume = sessionVolumes.reduce(function(a, b) { return a + b; }, 0);
  return {
    asset: asset, instrument: asset + "_" + currency + "_STOCK", priceType: INSTRUMENT_TYPES.STOCK_LAST,
    currency: currency, volumeUnit: "shares", name: cat.name, symbol: asset,
    provider: "yahoo", exchange: meta.exchangeName || cat.exchange || "Yahoo Finance",
    price: price, change24h: change === null ? null : change / previous * 100,
    changePercent24h: change === null ? null : change / previous * 100,
    changeAmount: change, previousClose: previous, open: open,
    high24h: high > 0 ? high : null, low24h: low > 0 ? low : null, volume24h: volume,
    bid: null, ask: null, spread: null,
    providerTimestamp: eventTime > 0 ? eventTime * 1000 : 0, receivedTimestamp: recTime,
    freshness: "CURRENT", assetClass: "stock", tradingPeriods: meta.currentTradingPeriod || null,
    marketState: sessionAt(meta.currentTradingPeriod, recTime)
  };
}

// Normalizes Yahoo candles payload
function normalizeYahooCandles(data) {
  if (!data || !data.chart || !Array.isArray(data.chart.result) || data.chart.result.length === 0) {
    return [];
  }
  var result = data.chart.result[0];
  if (!result || !Array.isArray(result.timestamp)) return [];

  var timestamps = result.timestamp;
  var quoteData = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
  var opens = quoteData.open || [];
  var highs = quoteData.high || [];
  var lows = quoteData.low || [];
  var closes = quoteData.close || [];
  var volumes = quoteData.volume || [];

  var list = [];
  for (var i = 0; i < timestamps.length; i++) {
    var c = closes[i];
    if (c === null || c === undefined || c === "") continue;
    var rawClose = Number(c);
    if (!Number.isFinite(rawClose)) continue;
    var closeVal = rawClose;

    var o = toFiniteNumber(opens[i], closeVal);
    var h = toFiniteNumber(highs[i], Math.max(o, closeVal));
    var l = toFiniteNumber(lows[i], Math.min(o, closeVal));
    var v = toFiniteNumber(volumes[i], 0);
    var t = toFiniteNumber(Number(timestamps[i]) * 1000, 0);

    list.push({
      time: t,
      open: o,
      high: h,
      low: l,
      close: closeVal,
      volume: v
    });
  }
  return list;
}

// Explicit Reference Price Calculation
// A reference is one explicit instrument, shared by headline and history. Never
// average USD with USDT or silently replace a spot market with a perpetual.
function selectedProvider(asset) {
  var cat = getCatalogItem(asset);
  return cat && cat.assetClass === "stock" ? "yahoo" : asset === "HYPE" ? "hyperliquid" : "binance";
}

function calculateReferenceQuote(asset, quotesByProvider, now) {
  var provider = selectedProvider(asset);
  return decorateQuote((quotesByProvider || {})[provider] || createEmptyQuote(asset, provider), now);
}

function validCurrency(currency) {
  // Yahoo also uses scaled units (GBp, ZAc); preserve case and never convert.
  return typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency) ? currency : null;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  var n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sessionAt(periods, now) {
  if (!periods) return "unknown";
  var sec = now / 1000;
  var names = ["regular", "pre", "post"];
  var labels = ["regular", "preMarket", "postMarket"];
  for (var i = 0; i < names.length; i++) {
    var p = periods[names[i]];
    if (p && sec >= p.start && sec < p.end) return labels[i];
  }
  return "closed";
}

function decorateQuote(quote, now) {
  var q = Object.assign({}, quote);
  var current = now === undefined ? Date.now() : now;
  if (q.assetClass === "stock") q.marketState = sessionAt(q.tradingPeriods, current);
  var age = Math.max(0, current - q.receivedTimestamp);
  var expected = q.provider === "yahoo" ? (q.marketState === "closed" ? 660000 : 120000) : 15000;
  q.freshness = !(q.price > 0) ? "UNAVAILABLE" : age <= expected ? (q.provider === "yahoo" ? "CURRENT" : "LIVE") : "STALE";
  return q;
}

function formatAge(timestamp, now) {
  if (!(timestamp > 0)) return "no update";
  var seconds = Math.max(0, Math.floor(((now === undefined ? Date.now() : now) - timestamp) / 1000));
  if (seconds < 60) return seconds + "s ago";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

// Strict and deterministic price formatting
function formatPrice(value, precision, currency) {
  var num = optionalNumber(value);
  if (num === null || num <= 0) return "—";
  var p;
  if (precision !== undefined) {
    p = precision;
  } else if (num >= 1000) {
    p = 2;
  } else if (num >= 1) {
    p = 2;
  } else if (num >= 0.0001) {
    p = 4;
  } else {
    p = 6;
  }
  var fixed = num.toFixed(p);
  var parts = fixed.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (currency === "USD" || currency === undefined ? "$" : (currency || "?") + " ") + parts.join(".");
}

function formatCompactPrice(value, currency, omitCurrency) {
  var num = optionalNumber(value);
  if (num === null || num <= 0) return "—";
  var prefix = omitCurrency ? "" : currency === "USD" || currency === undefined ? "$" : (currency || "?") + " ";
  var text = num >= 1e6 ? (num / 1e6).toFixed(2) + "M" : num >= 1000 ? (num / 1000).toFixed(num >= 10000 ? 1 : 2) + "K" : num.toFixed(num >= 10 ? 1 : num >= 1 ? 2 : num >= 0.01 ? 3 : 4);
  return prefix + text;
}

function formatPercentage(value) {
  var num = optionalNumber(value);
  if (num === null) return "—";
  var sign = num > 0 ? "+" : "";
  return sign + num.toFixed(2) + "%";
}

function formatVolume(value, unit) {
  var num = optionalNumber(value);
  if (num === null || num < 0) return "—";
  var text = num >= 1e9 ? (num / 1e9).toFixed(2) + "B" : num >= 1e6 ? (num / 1e6).toFixed(2) + "M" : num >= 1e3 ? (num / 1e3).toFixed(1) + "K" : num.toFixed(0);
  return text + " " + (unit || "USD");
}
