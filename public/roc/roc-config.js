/**
 * ROC Config — shared configuration loader for all ROC pages.
 * Fetches API keys (Cesium, Google Maps, Ably) from the Worker's /api/ovix/config endpoint.
 * Caches the result so multiple calls don't re-fetch.
 */
(function () {
  var API_BASE = 'https://ovix-api.tedlango.workers.dev';
  var _configPromise = null;

  window.RocConfig = {
    apiBase: API_BASE,                                        // kept for back-compat
    ovixApi: 'https://ovix-api.tedlango.workers.dev',         // OVIX scoring + config worker
    newsIntel: 'https://news-intel.tedlango.workers.dev',     // news-intel RSS/clustering worker
    travelIntel: 'https://travel-intel.tedlango.workers.dev', // travel-intel transit/maritime worker
    get: function () {
      if (!_configPromise) {
        _configPromise = fetch(API_BASE + '/api/ovix/config')
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; });
      }
      return _configPromise;
    }
  };
})();
