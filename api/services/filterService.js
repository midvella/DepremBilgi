
const TURKEY_BOUNDS = {
    minLat: 34.0,
    maxLat: 43.5,
    minLng: 24.5,
    maxLng: 46.5
};

const REGION_KEYWORDS = {
    marmara: [
        'marmara', 'istanbul', 'bursa', 'canakkale', 'çanakkale', 'balikesir', 'balıkesir',
        'yalova', 'kocaeli', 'tekirdag', 'tekirdağ', 'edirne', 'kirklareli', 'kırklareli',
        'gemlik', 'bandirma', 'bandırma', 'silivri', 'adalar'
    ],
    ege: [
        'ege', 'izmir', 'mugla', 'muğla', 'manisa', 'aydin', 'aydın', 'denizli',
        'usak', 'uşak', 'kutahya', 'kütahya', 'afyon', 'bodrum', 'marmaris',
        'datca', 'datça', 'kusadasi', 'kuşadası', 'seferihisar', 'fethiye', 'dodecanese', 'oniki adalar', 'crete', 'girit'
    ],
    akdeniz: [
        'akdeniz', 'antalya', 'mersin', 'adana', 'hatay', 'osmaniye', 'kahramanmaras', 'kahramanmaraş',
        'gaziantep', 'kibris', 'kıbrıs', 'cyprus', 'alanya', 'kas', 'kaş'
    ],
    icanadolu: [
        'ankara', 'konya', 'kayseri', 'eskisehir', 'eskişehir', 'sivas', 'kirikkale', 'kırıkkale',
        'aksaray', 'karaman', 'kirsehir', 'kırşehir', 'nigde', 'niğde', 'nevsehir', 'nevşehir', 'yozgat', 'cankiri', 'çankırı'
    ],
    karadeniz: [
        'karadeniz', 'trabzon', 'samsun', 'ordu', 'giresun', 'rize', 'artvin', 'sinop', 'kastamonu', 'zonguldak', 'bartin', 'bartın', 'bolu', 'duzce', 'düzce'
    ],
    dogu_guneydogu: [
        'elazig', 'elazığ', 'malatya', 'diyarbakir', 'diyarbakır', 'van', 'erzurum', 'erzincan', 'bingol', 'bingöl',
        'mus', 'muş', 'bitlis', 'hakkari', 'sirnak', 'şırnak', 'siirt', 'mardin', 'sanliurfa', 'şanlıurfa', 'adıyaman', 'adiyaman', 'kars', 'agri', 'ağrı', 'igdir', 'iğdır', 'ardahan', 'tunceli'
    ]
};

const TURKEY_ALL_KEYWORDS = [
    'turkey', 'türkiye', 'turkei', 'turquia',
    ...Object.values(REGION_KEYWORDS).flat()
];

const runtimeSettings = new Map();

function isEarthquakeInTurkey(eq) {
    if (!eq) return false;

    if (eq.source === 'Kandilli' || eq.source === 'AFAD') {
        return true;
    }

    const lat = parseFloat(eq.lat);
    const lng = parseFloat(eq.lng);

    if (!isNaN(lat) && !isNaN(lng)) {
        if (lat >= TURKEY_BOUNDS.minLat && lat <= TURKEY_BOUNDS.maxLat &&
            lng >= TURKEY_BOUNDS.minLng && lng <= TURKEY_BOUNDS.maxLng) {
            return true;
        }
    }

    const locText = normalizeText(`${eq.location || ''} ${eq.city || ''}`);
    return TURKEY_ALL_KEYWORDS.some(kw => locText.includes(normalizeText(kw)));
}

function isEarthquakeInRegion(eq, regionName) {
    if (!regionName || regionName === 'all' || regionName === 'global' || regionName === 'dunya') {
        return true;
    }

    const normRegion = regionName.toLowerCase().trim();

    if (normRegion === 'turkey' || normRegion === 'turkiye' || normRegion === 'tr') {
        return isEarthquakeInTurkey(eq);
    }

    const keywords = REGION_KEYWORDS[normRegion];
    if (keywords && keywords.length > 0) {
        const locText = normalizeText(`${eq.location || ''} ${eq.city || ''}`);
        return keywords.some(kw => locText.includes(normalizeText(kw)));
    }

    const locText = normalizeText(`${eq.location || ''} ${eq.city || ''}`);
    return locText.includes(normalizeText(normRegion));
}

function normalizeText(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
}

function matchesLocationKeywords(eq, keywordsList) {
    if (!keywordsList || keywordsList.length === 0) return true;

    const locText = normalizeText(`${eq.location || ''} ${eq.city || ''} ${eq.closestCity || ''}`);
    return keywordsList.some(kw => {
        const cleanKw = normalizeText(kw.trim());
        return cleanKw && locText.includes(cleanKw);
    });
}

function matchesFilter(eq, options = {}) {
    const minMag = typeof options.minMagnitude === 'number' ? options.minMagnitude : 3.0;
    if (eq.mag < minMag) {
        return { match: false, reason: `Büyüklük yetersiz (${eq.mag} < ${minMag})` };
    }

    if (typeof options.maxDepth === 'number' && options.maxDepth > 0) {
        if (eq.depth > options.maxDepth) {
            return { match: false, reason: `Derinlik fazla (${eq.depth} km > ${options.maxDepth} km)` };
        }
    }

    const region = options.region || 'turkey';
    if (!isEarthquakeInRegion(eq, region)) {
        return { match: false, reason: `Bölge dışında (${region})` };
    }

    if (Array.isArray(options.locations) && options.locations.length > 0) {
        if (!matchesLocationKeywords(eq, options.locations)) {
            return { match: false, reason: 'Belirlenen şehir/konum listesinde değil' };
        }
    }

    return { match: true };
}

async function getEffectiveFilterSettings(chatId = null) {
    const memSettings = chatId ? runtimeSettings.get(String(chatId)) : null;

    let redisSettings = null;
    const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken && chatId) {
        try {
            const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
            const res = await fetchFn(`${redisUrl}/get/settings_${chatId}`, {
                headers: { Authorization: `Bearer ${redisToken}` }
            });
            const data = await res.json();
            if (data.result) {
                redisSettings = JSON.parse(data.result);
            }
        } catch (e) {
            console.warn('[FilterService] Redis ayar okuma hatası:', e.message);
        }
    }

    const envMinMag = parseFloat(process.env.MIN_MAGNITUDE || '3.0');
    const envRegion = (process.env.ALERT_REGION || 'turkey').toLowerCase().trim();
    const envMaxDepth = process.env.MAX_DEPTH ? parseFloat(process.env.MAX_DEPTH) : null;
    const envLocations = process.env.ALERT_LOCATIONS
        ? process.env.ALERT_LOCATIONS.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    return {
        minMagnitude: redisSettings?.minMagnitude ?? memSettings?.minMagnitude ?? envMinMag,
        region: redisSettings?.region ?? memSettings?.region ?? envRegion,
        maxDepth: redisSettings?.maxDepth ?? memSettings?.maxDepth ?? envMaxDepth,
        locations: redisSettings?.locations ?? memSettings?.locations ?? envLocations
    };
}

async function updateFilterSettings(chatId, newSettings) {
    if (!chatId) return;

    const current = await getEffectiveFilterSettings(chatId);
    const updated = { ...current, ...newSettings };

    runtimeSettings.set(String(chatId), updated);

    const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (redisUrl && redisToken) {
        try {
            const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
            await fetchFn(`${redisUrl}/set/settings_${chatId}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${redisToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(JSON.stringify(updated))
            });
        } catch (e) {
            console.warn('[FilterService] Redis ayar yazma hatası:', e.message);
        }
    }

    return updated;
}

module.exports = {
    isEarthquakeInTurkey,
    isEarthquakeInRegion,
    matchesLocationKeywords,
    matchesFilter,
    getEffectiveFilterSettings,
    updateFilterSettings,
    REGION_KEYWORDS
};
