/**
 * ROC Config — shared configuration loader for all ROC pages.
 * Fetches API keys (Cesium, Google Maps, Ably) from the Worker's /api/ovix/config endpoint.
 * Caches the result so multiple calls don't re-fetch.
 */
(function () {
  var API_BASE = 'https://ovix-api.tedlango.workers.dev';
  var _configPromise = null;

  window.RocConfig = {
    apiBase: API_BASE,
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
