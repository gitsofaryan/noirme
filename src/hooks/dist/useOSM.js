"use strict";
exports.__esModule = true;
exports.useOSM = void 0;
var react_1 = require("react");
function useOSM(mapBounds, zoom) {
    var _a = react_1.useState([]), places = _a[0], setPlaces = _a[1];
    var cache = react_1.useRef(new Map());
    var abortControllerRef = react_1.useRef(null);
    // Clean up expired cache items from localStorage on mount
    react_1.useEffect(function () {
        if (typeof window === "undefined")
            return;
        try {
            var EXPIRE_TIME = 12 * 60 * 60 * 1000; // 12 hours
            var now = Date.now();
            var keysToRemove = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.startsWith("noirme_osm_cache_")) {
                    var raw = localStorage.getItem(key);
                    if (raw) {
                        var parsed = JSON.parse(raw);
                        if (now - parsed.timestamp > EXPIRE_TIME) {
                            keysToRemove.push(key);
                        }
                    }
                }
            }
            keysToRemove.forEach(function (key) { return localStorage.removeItem(key); });
            if (keysToRemove.length > 0) {
                console.log("[noirme-osm] Evicted " + keysToRemove.length + " expired OSM cache entries.");
            }
        }
        catch (e) {
            // Ignore local storage quota or privacy sandbox issues
        }
    }, []);
    react_1.useEffect(function () {
        // Only fetch if zoom is high enough to avoid massive queries
        if (!mapBounds || zoom < 14) {
            if (zoom < 14)
                setPlaces([]);
            return;
        }
        var sw = mapBounds._southWest, ne = mapBounds._northEast;
        // Round bounds to roughly 0.01 degrees to increase cache hit rate and reduce small fetch jitter
        var roundTo = 0.01;
        var cacheS = Math.floor(sw.lat / roundTo) * roundTo;
        var cacheW = Math.floor(sw.lng / roundTo) * roundTo;
        var cacheN = Math.ceil(ne.lat / roundTo) * roundTo;
        var cacheE = Math.ceil(ne.lng / roundTo) * roundTo;
        var cacheKey = cacheS + "," + cacheW + "," + cacheN + "," + cacheE;
        var storageKey = "noirme_osm_cache_" + cacheKey;
        // 1. In-memory fast cache check
        if (cache.current.has(cacheKey)) {
            setPlaces(cache.current.get(cacheKey));
            return;
        }
        // 2. Persistent localStorage cache check
        if (typeof window !== "undefined") {
            try {
                var raw = localStorage.getItem(storageKey);
                if (raw) {
                    var parsed = JSON.parse(raw);
                    var EXPIRE_TIME = 12 * 60 * 60 * 1000; // 12 hours
                    if (Date.now() - parsed.timestamp < EXPIRE_TIME) {
                        cache.current.set(cacheKey, parsed.places);
                        setPlaces(parsed.places);
                        return;
                    }
                    else {
                        localStorage.removeItem(storageKey);
                    }
                }
            }
            catch (e) { }
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        // Query Overpass API for amenities, leisure, and tourism within the rounded bounding box
        var query = "\n      [out:json][timeout:5];\n      (\n        node[\"amenity\"](" + cacheS + "," + cacheW + "," + cacheN + "," + cacheE + ");\n        node[\"leisure\"](" + cacheS + "," + cacheW + "," + cacheN + "," + cacheE + ");\n        node[\"tourism\"](" + cacheS + "," + cacheW + "," + cacheN + "," + cacheE + ");\n      );\n      out body;\n    ";
        var url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);
        fetch(url, { signal: abortControllerRef.current.signal })
            .then(function (res) {
            if (!res.ok)
                throw new Error("Overpass API rate limit or error");
            return res.json();
        })
            .then(function (data) {
            if (data && data.elements) {
                // Filter to places that actually have a name, as nameless generic buildings aren't useful for hotspots
                var namedPlaces = data.elements.filter(function (el) { return el.tags && el.tags.name; });
                // Cache in memory
                cache.current.set(cacheKey, namedPlaces);
                // Cache in persistent localStorage
                if (typeof window !== "undefined") {
                    try {
                        localStorage.setItem(storageKey, JSON.stringify({
                            places: namedPlaces,
                            timestamp: Date.now()
                        }));
                    }
                    catch (e) { }
                }
                setPlaces(namedPlaces);
            }
        })["catch"](function (err) {
            // Silently ignore aborted requests
            if (err.name === "AbortError")
                return;
            // Silently ignore transient network errors in production
            // (Failed to fetch usually indicates temporary network issues)
            if (typeof window !== "undefined" &&
                window.location.hostname === "localhost") {
                console.warn("[noirme] OSM fetch error:", err);
            }
        });
        return function () {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [mapBounds, zoom]);
    return places;
}
exports.useOSM = useOSM;
