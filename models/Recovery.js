.pragma library

// Check each feed independently: a healthy comparison feed must not hide a
// stale selected source. Keep recovery bounded while the network is unavailable.
function create(now) {
  var lastAttempt = {};
  return {
    record: function(id) { lastAttempt[id] = now(); },
    tick: function(providers, getQuote) {
      providers.forEach(function(provider) {
        if (!provider.active) { delete lastAttempt[provider.providerId]; return; }
        var stale = provider.targetAssets.some(function(asset) {
          var quote = getQuote(asset, provider.providerId);
          return !quote || quote.freshness === "STALE" || quote.freshness === "UNAVAILABLE";
        });
        var previous = lastAttempt[provider.providerId];
        if (!stale || (previous !== undefined && now() - previous < 15000)) return;
        lastAttempt[provider.providerId] = now();
        provider.refresh(false);
      });
    }
  };
}
