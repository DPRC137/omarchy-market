.pragma library

// A view projection only: never mutate the stored list or request market data.
function project(assets, query, category, sort, catalog, quote) {
  var needle = String(query || "").trim().toLowerCase();
  var result = (assets || []).filter(function(asset) {
    var item = catalog(asset) || {};
    return (category === "All" || (category === "Crypto" ? item.assetClass === "crypto" : item.assetClass === "stock")) &&
      (!needle || (asset + " " + (item.name || "")).toLowerCase().indexOf(needle) >= 0);
  });
  if (sort === "Symbol") result.sort();
  if (sort === "Gainers" || sort === "Losers") result.sort(function(a, b) {
    var av = (quote(a) || {}).change24h; var bv = (quote(b) || {}).change24h;
    var aValid = typeof av === "number" && isFinite(av); var bValid = typeof bv === "number" && isFinite(bv);
    if (!aValid || !bValid) return aValid ? -1 : bValid ? 1 : 0;
    return sort === "Gainers" ? bv - av : av - bv;
  });
  return result;
}
