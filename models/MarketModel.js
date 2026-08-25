// MarketModel.js - Core data normalization, instrument catalog, and structured persistence for Omarchy Market

.pragma library

var SCHEMA_VERSION = 1;
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
    instrument: "HYPE_USD_PERP",
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

function getCatalogItem(assetOrQuery) {
  if (!assetOrQuery) return null;
  var q = String(assetOrQuery).trim();
  var upper = q.toUpperCase();
  if (CATALOG_BY_ASSET[upper]) return CATALOG_BY_ASSET[upper];

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
    if (symLower.indexOf(raw) !== -1 || nameLower.indexOf(raw) !== -1) {
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
      if (!it || !it.asset) continue;
      var assetKey = String(it.asset).trim().toUpperCase();
      if (!assetKey || seen[assetKey]) continue;

      var catalogEntry = getCatalogItem(assetKey);
      if (!catalogEntry) continue; // Reject invalid/unsupported markets

      seen[assetKey] = true;
      cleanItems.push({
        asset: catalogEntry.asset,
        name: it.name || catalogEntry.name,
        instrument: catalogEntry.instrument,
        precision: catalogEntry.precision,
        assetClass: catalogEntry.assetClass || "crypto",
        providers: Object.assign({}, catalogEntry.providers, it.providers || {})
      });

      if (cleanItems.length >= MAX_WATCHLIST_SIZE) break;
    }

    if (cleanItems.length === 0) {
      return createDefaultWatchlist();
    }

    return {
      version: typeof parsed.version === "number" ? parsed.version : SCHEMA_VERSION,
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

  var targetAsset = (typeof assetOrItem === "object" && assetOrItem.asset) ? assetOrItem.asset : assetOrItem;
  var catalogItem = getCatalogItem(targetAsset);
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
  var prov = provider || "aggregate";
  var isStock = (cat.assetClass === "stock" || (cat.instrument && cat.instrument.indexOf("STOCK") !== -1));
  var isPerp = (!isStock && (asset === "HYPE" || prov === "hyperliquid" || (cat.instrument && cat.instrument.indexOf("PERP") !== -1)));

  var inst = isStock ? (asset + "_USD_STOCK") : (isPerp ? (asset + "_USD_PERP") : (asset + "_USD_SPOT"));
  var pType = isStock ? INSTRUMENT_TYPES.STOCK_LAST : (isPerp ? INSTRUMENT_TYPES.PERP_MID : INSTRUMENT_TYPES.SPOT_LAST);

  return {
    asset: asset,
    instrument: inst,
    priceType: pType,
    name: cat.name,
    icon: "",
    symbol: isStock ? asset : (asset + "/USD"),
    provider: prov,
    exchange: providerDisplayName(prov),
    price: 0,
    change24h: 0,
    changePercent24h: 0,
    changeAmount: 0,
    previousClose: 0,
    open: 0,
    high24h: 0,
    low24h: 0,
    volume24h: 0,
    bid: 0,
    ask: 0,
    spread: 0,
    providerTimestamp: 0,
    receivedTimestamp: 0,
    freshness: "OFFLINE",
    assetClass: isStock ? "stock" : "crypto",
    marketState: "closed"
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
  var symbol = String(data.s || "");
  var asset = inferAssetFromBinanceSymbol(symbol);
  if (!asset) return null;

  var cat = getCatalogItem(asset);
  if (!cat) return null;

  var price = parseFloat(data.c || 0);
  var change24h = parseFloat(data.P || 0);
  var high24h = parseFloat(data.h || 0);
  var low24h = parseFloat(data.l || 0);
  var volume24h = parseFloat(data.q || 0);
  var bid = parseFloat(data.b || 0);
  var ask = parseFloat(data.a || 0);
  var eventTime = parseInt(data.E || Date.now(), 10);
  var recTime = now || Date.now();

  return {
    asset: asset,
    instrument: cat.instrument,
    priceType: INSTRUMENT_TYPES.SPOT_LAST,
    name: cat.name,
    icon: "",
    symbol: asset + "/USD",
    provider: "binance",
    exchange: "Binance",
    price: isNaN(price) ? 0 : price,
    change24h: isNaN(change24h) ? 0 : change24h,
    changePercent24h: isNaN(change24h) ? 0 : change24h,
    changeAmount: 0,
    previousClose: 0,
    open: 0,
    high24h: isNaN(high24h) ? 0 : high24h,
    low24h: isNaN(low24h) ? 0 : low24h,
    volume24h: isNaN(volume24h) ? 0 : volume24h,
    bid: isNaN(bid) ? 0 : bid,
    ask: isNaN(ask) ? 0 : ask,
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
  if (!cat) return null;

  var price = parseFloat(data.price || 0);
  var open24h = parseFloat(data.open_24h || 0);
  var change24h = 0;
  if (open24h > 0 && price > 0) {
    change24h = ((price - open24h) / open24h) * 100;
  }
  var high24h = parseFloat(data.high_24h || 0);
  var low24h = parseFloat(data.low_24h || 0);
  var baseVol = parseFloat(data.volume_24h || 0);
  var volume24h = baseVol * (price > 0 ? price : 1);
  var bid = parseFloat(data.best_bid || 0);
  var ask = parseFloat(data.best_ask || 0);
  var eventTime = data.time ? Date.parse(data.time) : Date.now();
  var recTime = now || Date.now();

  return {
    asset: asset,
    instrument: cat.instrument,
    priceType: INSTRUMENT_TYPES.SPOT_LAST,
    name: cat.name,
    icon: "",
    symbol: asset + "/USD",
    provider: "coinbase",
    exchange: "Coinbase",
    price: isNaN(price) ? 0 : price,
    change24h: isNaN(change24h) ? 0 : change24h,
    changePercent24h: isNaN(change24h) ? 0 : change24h,
    changeAmount: 0,
    previousClose: open24h,
    open: open24h,
    high24h: isNaN(high24h) ? 0 : high24h,
    low24h: isNaN(low24h) ? 0 : low24h,
    volume24h: isNaN(volume24h) ? 0 : volume24h,
    bid: isNaN(bid) ? 0 : bid,
    ask: isNaN(ask) ? 0 : ask,
    spread: (bid > 0 && ask >= bid) ? (ask - bid) : 0,
    providerTimestamp: isNaN(eventTime) ? recTime : eventTime,
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
    var price = parseFloat(ctx.markPx || ctx.midPx || 0);
    var prevDay = parseFloat(ctx.prevDayPx || 0);
    var change24h = 0;
    if (prevDay > 0 && price > 0) {
      change24h = ((price - prevDay) / prevDay) * 100;
    }
    var volume24h = parseFloat(ctx.dayNtlVlm || 0);
    var bid = ctx.impactPxs && ctx.impactPxs[0] ? parseFloat(ctx.impactPxs[0]) : price;
    var ask = ctx.impactPxs && ctx.impactPxs[1] ? parseFloat(ctx.impactPxs[1]) : price;

    results.push({
      asset: name,
      instrument: name + "_USD_PERP",
      priceType: INSTRUMENT_TYPES.PERP_MID,
      name: cat ? cat.name : name,
      icon: "",
      symbol: name + "/USD",
      provider: "hyperliquid",
      exchange: "Hyperliquid",
      price: isNaN(price) ? 0 : price,
      change24h: isNaN(change24h) ? 0 : change24h,
      changePercent24h: isNaN(change24h) ? 0 : change24h,
      changeAmount: 0,
      previousClose: prevDay,
      open: prevDay,
      high24h: 0,
      low24h: 0,
      volume24h: isNaN(volume24h) ? 0 : volume24h,
      bid: isNaN(bid) ? 0 : bid,
      ask: isNaN(ask) ? 0 : ask,
      spread: (bid > 0 && ask >= bid) ? (ask - bid) : 0,
      providerTimestamp: recTime,
      receivedTimestamp: recTime,
      freshness: "LIVE",
      assetClass: "crypto",
      marketState: "regular"
    });
  }

  return results;
}

// Normalizes Yahoo Finance v8 chart API payload for Equities
function normalizeYahooChart(data, now) {
  if (!data || !data.chart || !Array.isArray(data.chart.result) || data.chart.result.length === 0) {
    return null;
  }
  var result = data.chart.result[0];
  if (!result || !result.meta) return null;
  var meta = result.meta;
  var symbol = String(meta.symbol || "").toUpperCase();
  if (!symbol) return null;

  var cat = getCatalogItem(symbol);
  if (!cat) return null;

  var recTime = now || Date.now();
  var timestamps = result.timestamp || [];
  var quoteData = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
  var opens = quoteData.open || [];
  var highs = quoteData.high || [];
  var lows = quoteData.low || [];
  var closes = quoteData.close || [];
  var volumes = quoteData.volume || [];

  // Find latest valid close price by scanning backwards
  var price = 0;
  var lastTimestampSec = 0;
  for (var i = closes.length - 1; i >= 0; i--) {
    var cVal = closes[i];
    if (cVal !== null && cVal !== undefined && !isNaN(cVal) && Number(cVal) > 0) {
      price = Number(cVal);
      if (timestamps[i]) {
        lastTimestampSec = Number(timestamps[i]);
      }
      break;
    }
  }

  // Fallback to meta.regularMarketPrice if chart close array didn't yield a valid value
  if (price <= 0 && meta.regularMarketPrice && !isNaN(meta.regularMarketPrice)) {
    price = Number(meta.regularMarketPrice);
  }
  if (price <= 0) return null;

  // Determine market state from meta.currentTradingPeriod
  // currentTradingPeriod has { pre: { start, end }, regular: { start, end }, post: { start, end } } (in unix epoch seconds)
  var marketState = "regular";
  var nowSec = Math.floor(recTime / 1000);
  var ctp = meta.currentTradingPeriod;
  var regStart = 0;
  var regEnd = 0;

  if (ctp) {
    if (ctp.regular && ctp.regular.start && ctp.regular.end) {
      regStart = Number(ctp.regular.start);
      regEnd = Number(ctp.regular.end);
    }
    var preStart = ctp.pre ? Number(ctp.pre.start) : 0;
    var preEnd = ctp.pre ? Number(ctp.pre.end) : 0;
    var postStart = ctp.post ? Number(ctp.post.start) : 0;
    var postEnd = ctp.post ? Number(ctp.post.end) : 0;

    if (regStart > 0 && nowSec >= regStart && nowSec < regEnd) {
      marketState = "regular";
    } else if (preStart > 0 && nowSec >= preStart && nowSec < preEnd) {
      marketState = "preMarket";
    } else if (postStart > 0 && nowSec >= postStart && nowSec < postEnd) {
      marketState = "postMarket";
    } else {
      marketState = "closed";
    }
  }

  // Determine regular-session open price from first regular-session OHLC bar (at or after regStart)
  var openPrice = 0;
  if (regStart > 0 && timestamps.length > 0) {
    for (var j = 0; j < timestamps.length; j++) {
      if (Number(timestamps[j]) >= regStart) {
        if (opens[j] !== null && opens[j] !== undefined && !isNaN(opens[j]) && Number(opens[j]) > 0) {
          openPrice = Number(opens[j]);
        } else if (closes[j] !== null && closes[j] !== undefined && !isNaN(closes[j]) && Number(closes[j]) > 0) {
          openPrice = Number(closes[j]);
        }
        break;
      }
    }
  }
  if (openPrice <= 0 && meta.regularMarketPrice) {
    openPrice = Number(meta.regularMarketPrice);
  }

  // Determine reference close price for change calculation:
  // - Pre-market: previous trading day's regular close
  // - Regular session: previous trading day's regular close
  // - Post-market: today's regular-session close (identified from chart data at or before regEnd)
  var prevClose = 0;
  if (marketState === "postMarket") {
    if (regEnd > 0 && timestamps.length > 0) {
      for (var k = timestamps.length - 1; k >= 0; k--) {
        if (Number(timestamps[k]) <= regEnd) {
          if (closes[k] !== null && closes[k] !== undefined && !isNaN(closes[k]) && Number(closes[k]) > 0) {
            prevClose = Number(closes[k]);
            break;
          }
        }
      }
    }
    if (prevClose <= 0 && meta.regularMarketPrice && !isNaN(meta.regularMarketPrice)) {
      prevClose = Number(meta.regularMarketPrice);
    }
  }

  // Fallback to previous day's close for regular / pre-market / closed, or if post-market didn't locate a today close
  if (prevClose <= 0) {
    if (meta.previousClose !== null && meta.previousClose !== undefined && !isNaN(meta.previousClose) && Number(meta.previousClose) > 0) {
      prevClose = Number(meta.previousClose);
    } else if (meta.chartPreviousClose !== null && meta.chartPreviousClose !== undefined && !isNaN(meta.chartPreviousClose) && Number(meta.chartPreviousClose) > 0) {
      prevClose = Number(meta.chartPreviousClose);
    }
  }

  var changeAmount = 0;
  var change24h = 0; // percentage change in Omarchy Market schema
  if (prevClose > 0 && price > 0) {
    changeAmount = price - prevClose;
    change24h = (changeAmount / prevClose) * 100;
  }

  // High, Low, Volume
  var high24h = 0;
  var low24h = 0;
  var volume24h = 0;

  if (meta.regularMarketDayHigh && !isNaN(meta.regularMarketDayHigh)) {
    high24h = Number(meta.regularMarketDayHigh);
  }
  if (meta.regularMarketDayLow && !isNaN(meta.regularMarketDayLow)) {
    low24h = Number(meta.regularMarketDayLow);
  }
  if (meta.regularMarketVolume && !isNaN(meta.regularMarketVolume)) {
    volume24h = Number(meta.regularMarketVolume);
  }

  // Fallback high/low/volume from today's bars if meta fields are missing/zero
  if (high24h <= 0 || low24h <= 0) {
    var computedHigh = -Infinity;
    var computedLow = Infinity;
    var computedVol = 0;
    var startFilter = regStart > 0 ? regStart : 0;
    for (var m = 0; m < timestamps.length; m++) {
      if (Number(timestamps[m]) >= startFilter) {
        if (highs[m] !== null && !isNaN(highs[m])) {
          var h = Number(highs[m]);
          if (h > computedHigh) computedHigh = h;
        }
        if (lows[m] !== null && !isNaN(lows[m])) {
          var l = Number(lows[m]);
          if (l > 0 && l < computedLow) computedLow = l;
        }
        if (volumes[m] !== null && !isNaN(volumes[m])) {
          computedVol += Number(volumes[m]);
        }
      }
    }
    if (high24h <= 0 && computedHigh !== -Infinity) high24h = computedHigh;
    if (low24h <= 0 && computedLow !== Infinity) low24h = computedLow;
    if (volume24h <= 0 && computedVol > 0) volume24h = computedVol;
  }

  var eventTime = lastTimestampSec > 0 ? (lastTimestampSec * 1000) : (meta.regularMarketTime ? Number(meta.regularMarketTime) * 1000 : recTime);

  return {
    asset: symbol,
    instrument: cat.instrument || (symbol + "_USD_STOCK"),
    priceType: INSTRUMENT_TYPES.STOCK_LAST,
    name: cat.name,
    icon: "",
    symbol: symbol,
    provider: "yahoo",
    exchange: cat.exchange || meta.exchangeName || "Yahoo Finance",
    price: price,
    change24h: isNaN(change24h) ? 0 : change24h,
    changePercent24h: isNaN(change24h) ? 0 : change24h,
    changeAmount: isNaN(changeAmount) ? 0 : changeAmount,
    previousClose: prevClose,
    open: openPrice > 0 ? openPrice : price,
    high24h: high24h > 0 ? high24h : price,
    low24h: low24h > 0 ? low24h : price,
    volume24h: volume24h,
    bid: price,
    ask: price,
    spread: 0,
    providerTimestamp: eventTime,
    receivedTimestamp: recTime,
    freshness: "LIVE",
    assetClass: "stock",
    marketState: marketState
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
    if (c === null || c === undefined || isNaN(c)) continue;
    var closeVal = Number(c);
    var o = (opens[i] !== null && opens[i] !== undefined && !isNaN(opens[i])) ? Number(opens[i]) : closeVal;
    var h = (highs[i] !== null && highs[i] !== undefined && !isNaN(highs[i])) ? Number(highs[i]) : Math.max(o, closeVal);
    var l = (lows[i] !== null && lows[i] !== undefined && !isNaN(lows[i])) ? Number(lows[i]) : Math.min(o, closeVal);
    var v = (volumes[i] !== null && volumes[i] !== undefined && !isNaN(volumes[i])) ? Number(volumes[i]) : 0;
    var t = Number(timestamps[i]) * 1000;

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
function calculateReferenceQuote(asset, quotesByProvider, now) {
  var cat = getCatalogItem(asset);
  var isStock = (cat && (cat.assetClass === "stock" || (cat.instrument && cat.instrument.indexOf("STOCK") !== -1)));
  var isPerpOnly = (asset === "HYPE" || (cat && cat.instrument && cat.instrument.indexOf("PERP") !== -1));

  if (isStock) {
    var yahooQuote = quotesByProvider["yahoo"];
    if (yahooQuote && yahooQuote.price > 0 && getFreshness(yahooQuote.receivedTimestamp, now) !== "OFFLINE") {
      return yahooQuote;
    }
    return createEmptyQuote(asset, "yahoo");
  }

  if (isPerpOnly) {
    var hlQuote = quotesByProvider["hyperliquid"];
    if (hlQuote && hlQuote.price > 0 && getFreshness(hlQuote.receivedTimestamp, now) !== "OFFLINE") {
      return hlQuote;
    }
    return createEmptyQuote(asset, "hyperliquid");
  }

  // Combine compatible spot providers (Binance + Coinbase)
  var spotQuotes = [];
  var spotProviders = ["binance", "coinbase"];
  for (var i = 0; i < spotProviders.length; i++) {
    var q = quotesByProvider[spotProviders[i]];
    if (q && q.price > 0 && getFreshness(q.receivedTimestamp, now) !== "OFFLINE") {
      spotQuotes.push(q);
    }
  }

  if (spotQuotes.length === 0) {
    var hl = quotesByProvider["hyperliquid"];
    if (hl && hl.price > 0 && getFreshness(hl.receivedTimestamp, now) !== "OFFLINE") {
      return hl;
    }
    return createEmptyQuote(asset, "aggregate");
  }

  if (spotQuotes.length === 1) {
    return spotQuotes[0];
  }

  var totalPrice = 0;
  var totalChange = 0;
  var totalVolume = 0;
  var maxHigh = 0;
  var minLow = Infinity;
  var bestBid = 0;
  var bestAsk = Infinity;
  var latestRec = 0;

  for (var k = 0; k < spotQuotes.length; k++) {
    var item = spotQuotes[k];
    totalPrice += item.price;
    totalChange += item.change24h;
    totalVolume += item.volume24h;
    if (item.high24h > maxHigh) maxHigh = item.high24h;
    if (item.low24h > 0 && item.low24h < minLow) minLow = item.low24h;
    if (item.bid > bestBid) bestBid = item.bid;
    if (item.ask > 0 && item.ask < bestAsk) bestAsk = item.ask;
    if (item.receivedTimestamp > latestRec) latestRec = item.receivedTimestamp;
  }

  var avgPrice = totalPrice / spotQuotes.length;
  var avgChange = totalChange / spotQuotes.length;
  var name = cat ? cat.name : asset;

  return {
    asset: asset,
    instrument: asset + "_USD_SPOT",
    priceType: INSTRUMENT_TYPES.SPOT_LAST,
    name: name,
    icon: "",
    symbol: asset + "/USD",
    provider: "aggregate",
    exchange: "Reference Spot (" + spotQuotes.length + " feeds)",
    price: avgPrice,
    change24h: avgChange,
    changePercent24h: avgChange,
    changeAmount: 0,
    previousClose: 0,
    open: 0,
    high24h: maxHigh > 0 ? maxHigh : avgPrice,
    low24h: minLow !== Infinity ? minLow : avgPrice,
    volume24h: totalVolume,
    bid: bestBid,
    ask: bestAsk !== Infinity ? bestAsk : avgPrice,
    spread: (bestBid > 0 && bestAsk !== Infinity && bestAsk >= bestBid) ? (bestAsk - bestBid) : 0,
    providerTimestamp: latestRec,
    receivedTimestamp: latestRec,
    freshness: getFreshness(latestRec, now),
    assetClass: "crypto",
    marketState: "regular"
  };
}

// Strict and deterministic price formatting
function formatPrice(value, precision) {
  var num = Number(value);
  if (isNaN(num) || num === 0) return "$0.00";
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
  return "$" + parts.join(".");
}

function formatCompactPrice(value) {
  var num = Number(value);
  if (isNaN(num) || num === 0) return "$0";
  if (num >= 1000000) {
    return "$" + (num / 1000000).toFixed(2) + "M";
  }
  if (num >= 1000) {
    return "$" + (num / 1000).toFixed(num >= 10000 ? 1 : 2) + "K";
  }
  if (num >= 10) {
    return "$" + num.toFixed(1);
  }
  if (num >= 1) {
    return "$" + num.toFixed(2);
  }
  if (num >= 0.01) {
    return "$" + num.toFixed(3);
  }
  return "$" + num.toFixed(4);
}

function formatPercentage(value) {
  var num = Number(value);
  if (isNaN(num)) return "0.00%";
  var sign = num > 0 ? "+" : "";
  return sign + num.toFixed(2) + "%";
}

function formatVolume(value) {
  var num = Number(value);
  if (isNaN(num) || num <= 0) return "$0";
  if (num >= 1e9) {
    return "$" + (num / 1e9).toFixed(2) + "B";
  }
  if (num >= 1e6) {
    return "$" + (num / 1e6).toFixed(2) + "M";
  }
  if (num >= 1e3) {
    return "$" + (num / 1e3).toFixed(1) + "K";
  }
  return "$" + num.toFixed(0);
}

