
const geo = require('../utils/geo');

const fetchFn = typeof fetch !== 'undefined' ? fetch : (() => {
    try {
        return require('node-fetch');
    } catch {
        return null;
    }
})();

const API_ENDPOINTS = {
    KANDILLI: 'https://api.orhanaydogdu.com.tr/deprem/kandilli/live',
    AFAD: 'https://api.orhanaydogdu.com.tr/deprem/afad/live',
    USGS_TURKEY: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=35&maxlatitude=43&minlongitude=25&maxlongitude=45&minmagnitude=1.0&orderby=time&limit=200',
    USGS_GLOBAL: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    EMSC: 'https://www.seismicportal.eu/fdsnws/event/1/query?limit=100&format=json&minmag=2.0&orderby=time'
};

async function safeFetch(url, timeoutMs = 8000) {
    if (!fetchFn) {
        console.error('Fetch fonksiyonu bulunamadı.');
        return null;
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
        const options = {
            headers: { 'User-Agent': 'DepremBilgiSistemi/1.0' }
        };
        if (controller) options.signal = controller.signal;

        const res = await fetchFn(url, options);
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        if (timer) clearTimeout(timer);
        console.warn(`[Deprem Servisi] Fetch hatası (${url}):`, err.message);
        return null;
    }
}

function extractCity(title) {
    if (!title) return 'Bilinmiyor';
    const match = title.match(/\(([^)]+)\)/);
    if (match) {
        const raw = match[1].trim();
        return raw.charAt(0).toLocaleUpperCase('tr-TR') + raw.slice(1).toLocaleLowerCase('tr-TR');
    }
    const parts = title.split('-');
    if (parts.length > 1) {
        return parts[parts.length - 1].trim();
    }
    return title;
}

function extractUSGSRegion(place) {
    if (!place) return 'Bilinmiyor';
    const parts = place.split(', ');
    return parts[parts.length - 1] || place;
}

function getMagnitudeLabel(mag) {
    if (mag >= 7.0) return 'Çok Şiddetli / Yıkıcı';
    if (mag >= 6.0) return 'Şiddetli';
    if (mag >= 5.0) return 'Kuvvetli';
    if (mag >= 4.0) return 'Orta Büyüklükte';
    if (mag >= 3.0) return 'Hafif';
    if (mag >= 2.0) return 'Çok Hafif';
    return 'Mikro';
}

function getDepthCategory(depth) {
    if (depth <= 5) return 'Çok Sığ';
    if (depth <= 10) return 'Sığ';
    if (depth <= 35) return 'Normal';
    if (depth <= 70) return 'Orta Derinlik';
    return 'Derin';
}

function enrichEarthquake(eq) {
    const lat = parseFloat(eq.lat);
    const lng = parseFloat(eq.lng);
    const mag = parseFloat(eq.mag);
    const depth = parseFloat(eq.depth || 0);

    return {
        ...eq,
        lat,
        lng,
        mag: Math.round(mag * 10) / 10,
        depth: Math.round(depth * 10) / 10,
        latDMS: geo.toDMS(lat, true),
        lngDMS: geo.toDMS(lng, false),
        coordinatesDMS: geo.formatCoordinatesDMS(lat, lng),
        googleMapsUrl: geo.getGoogleMapsUrl(lat, lng),
        osmUrl: geo.getOsmUrl(lat, lng),
        magLabel: getMagnitudeLabel(mag),
        depthCategory: getDepthCategory(depth)
    };
}

async function fetchKandilli() {
    const data = await safeFetch(API_ENDPOINTS.KANDILLI);
    if (!data?.status || !Array.isArray(data?.result)) return [];

    return data.result.map(eq => enrichEarthquake({
        id: 'kandilli_' + eq.earthquake_id,
        mag: eq.mag,
        depth: eq.depth || 0,
        lat: eq.geojson?.coordinates ? eq.geojson.coordinates[1] : eq.lat,
        lng: eq.geojson?.coordinates ? eq.geojson.coordinates[0] : eq.lng,
        location: eq.title,
        city: eq.location_properties?.epiCenter?.name || extractCity(eq.title),
        date: eq.date_time ? `${eq.date_time}+03:00` : new Date().toISOString(),
        source: 'Kandilli',
        closestCity: eq.location_properties?.closestCity?.name || '',
        closestCityDistance: eq.location_properties?.closestCity?.distance || 0,
        closestCities: eq.location_properties?.closestCities?.slice(0, 3).map(c => c.name) || []
    }));
}

async function fetchAFAD() {
    const data = await safeFetch(API_ENDPOINTS.AFAD);
    if (!data?.status || !Array.isArray(data?.result)) return [];

    return data.result.map(eq => enrichEarthquake({
        id: 'afad_' + eq.earthquake_id,
        mag: eq.mag,
        depth: eq.depth || 0,
        lat: eq.geojson?.coordinates ? eq.geojson.coordinates[1] : eq.lat,
        lng: eq.geojson?.coordinates ? eq.geojson.coordinates[0] : eq.lng,
        location: eq.title,
        city: eq.location_properties?.epiCenter?.name || extractCity(eq.title),
        date: eq.date_time ? `${eq.date_time}+03:00` : new Date().toISOString(),
        source: 'AFAD',
        closestCity: eq.location_properties?.closestCity?.name || '',
        closestCityDistance: eq.location_properties?.closestCity?.distance || 0,
        closestCities: eq.location_properties?.closestCities?.slice(0, 3).map(c => c.name) || []
    }));
}

async function fetchUSGS() {
    const [turkeyData, globalData] = await Promise.all([
        safeFetch(API_ENDPOINTS.USGS_TURKEY),
        safeFetch(API_ENDPOINTS.USGS_GLOBAL)
    ]);

    const results = [];

    const parseUSGSFeature = (f, isGlobal = false) => {
        const coords = f.geometry?.coordinates || [0, 0, 0];
        return enrichEarthquake({
            id: 'usgs_' + f.id,
            mag: f.properties?.mag || 0,
            depth: coords[2] || 0,
            lat: coords[1],
            lng: coords[0],
            location: f.properties?.place || 'Bilinmiyor',
            city: extractUSGSRegion(f.properties?.place),
            date: new Date(f.properties?.time || Date.now()).toISOString(),
            source: 'USGS',
            tsunami: f.properties?.tsunami === 1,
            alert: f.properties?.alert || null,
            felt: f.properties?.felt || null,
            url: f.properties?.url || null
        });
    };

    if (turkeyData?.features && Array.isArray(turkeyData.features)) {
        turkeyData.features.forEach(f => results.push(parseUSGSFeature(f, false)));
    }

    if (globalData?.features && Array.isArray(globalData.features)) {
        globalData.features.forEach(f => {
            const coords = f.geometry?.coordinates || [0, 0];
            const isDup = results.some(r =>
                Math.abs(r.lat - coords[1]) < 0.15 &&
                Math.abs(r.lng - coords[0]) < 0.15
            );
            if (!isDup) results.push(parseUSGSFeature(f, true));
        });
    }

    return results;
}

async function fetchEMSC() {
    const data = await safeFetch(API_ENDPOINTS.EMSC);
    if (!data?.features || !Array.isArray(data.features)) return [];

    return data.features.map(f => enrichEarthquake({
        id: 'emsc_' + f.id,
        mag: f.properties?.mag || 0,
        depth: f.properties?.depth || 0,
        lat: f.properties?.lat,
        lng: f.properties?.lon,
        location: f.properties?.flynn_region || 'Bilinmiyor',
        city: f.properties?.flynn_region || '',
        date: f.properties?.time || new Date().toISOString(),
        source: 'EMSC'
    }));
}

function deduplicateEarthquakes(earthquakes) {
    const unique = [];

    earthquakes.forEach(eq => {
        let isDuplicate = false;
        const eqTime = new Date(eq.date).getTime();

        for (const u of unique) {
            const uTime = new Date(u.date).getTime();
            const timeDiff = Math.abs(eqTime - uTime);
            const latDiff = Math.abs(eq.lat - u.lat);
            const lngDiff = Math.abs(eq.lng - u.lng);
            const magDiff = Math.abs(eq.mag - u.mag);

            if (timeDiff < 180000 && latDiff < 0.2 && lngDiff < 0.2 && magDiff < 0.6) {
                isDuplicate = true;
                if (!u.sources) u.sources = [u.source];
                if (!u.sources.includes(eq.source)) u.sources.push(eq.source);
                if (eq.closestCity && !u.closestCity) {
                    u.closestCity = eq.closestCity;
                    u.closestCityDistance = eq.closestCityDistance;
                }
                break;
            }
        }

        if (!isDuplicate) {
            eq.sources = [eq.source];
            unique.push(eq);
        }
    });

    return unique;
}

async function getAggregatedEarthquakes() {
    const results = await Promise.allSettled([
        fetchKandilli(),
        fetchAFAD(),
        fetchUSGS(),
        fetchEMSC()
    ]);

    const sourceStatus = {};
    const sourceNames = ['kandilli', 'afad', 'usgs', 'emsc'];
    let all = [];

    results.forEach((res, i) => {
        const name = sourceNames[i];
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            all.push(...res.value);
            sourceStatus[name] = {
                status: 'online',
                count: res.value.length
            };
        } else {
            sourceStatus[name] = {
                status: 'offline',
                error: res.reason?.message || 'Bağlantı kurulamadı'
            };
        }
    });

    const earthquakes = deduplicateEarthquakes(all);
    earthquakes.sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
        timestamp: new Date().toISOString(),
        total: earthquakes.length,
        sources: sourceStatus,
        earthquakes
    };
}

module.exports = {
    getAggregatedEarthquakes,
    fetchKandilli,
    fetchAFAD,
    fetchUSGS,
    fetchEMSC,
    deduplicateEarthquakes,
    enrichEarthquake
};
