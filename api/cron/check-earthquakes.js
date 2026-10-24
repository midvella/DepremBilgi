
const earthquakeService = require('../services/earthquakeService');
const telegram = require('../utils/telegram');

const memoryCache = new Map();

function cleanupMemoryCache() {
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    for (const [id, timestamp] of memoryCache.entries()) {
        if (timestamp < twoHoursAgo) {
            memoryCache.delete(id);
        }
    }
}

async function checkAndMarkWithRedis(id) {
    const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
        return null; 
    }

    try {
        const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
        const checkRes = await fetchFn(`${redisUrl}/sismember/seen_earthquakes/${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${redisToken}` }
        });
        const checkData = await checkRes.json();
        const alreadySeen = checkData.result === 1;

        if (alreadySeen) return true;

        await fetchFn(`${redisUrl}/sadd/seen_earthquakes/${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${redisToken}` }
        });
        await fetchFn(`${redisUrl}/expire/seen_earthquakes/86400`, {
            headers: { Authorization: `Bearer ${redisToken}` }
        });

        return false;
    } catch (err) {
        console.warn('[Cron] Redis erişim hatası, yerel önbellek devrede:', err.message);
        return null;
    }
}

module.exports = async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
        const isLocalDev = process.env.NODE_ENV !== 'production';
        const apiKey = req.query.key;
        if (!isLocalDev && apiKey !== cronSecret) {
            return res.status(401).json({ success: false, error: 'Yetkisiz erişim (Unauthorized)' });
        }
    }

    const startTime = Date.now();
    cleanupMemoryCache();

    const filterService = require('../services/filterService');
    const activeFilters = await filterService.getEffectiveFilterSettings();

    const minMag = activeFilters.minMagnitude;
    const region = activeFilters.region;
    const maxAgeMinutes = parseInt(process.env.CHECK_WINDOW_MINUTES || '15', 10);
    const cutoffTime = new Date(Date.now() - (maxAgeMinutes * 60 * 1000));

    try {
        console.log(`[Cron] Deprem kontrolü başladı. Bölge: ${region}, Min Büyüklük: ${minMag}, Pencere: Son ${maxAgeMinutes} dk`);

        const data = await earthquakeService.getAggregatedEarthquakes();
        const allQuakes = data.earthquakes || [];

        const candidates = allQuakes.filter(eq => {
            const eqDate = new Date(eq.date);
            if (eqDate < cutoffTime) return false;

            const check = filterService.matchesFilter(eq, activeFilters);
            return check.match;
        });

        console.log(`[Cron] Toplam ${allQuakes.length} deprem tarandı. Filtrelere uyan ${candidates.length} aday bulundu.`);

        const alertsSent = [];
        const skippedAlreadySent = [];

        for (const eq of candidates) {
            const quakeKey = eq.id || `${eq.lat.toFixed(2)}_${eq.lng.toFixed(2)}_${new Date(eq.date).toISOString().slice(0, 16)}`;

            let alreadyNotified = await checkAndMarkWithRedis(quakeKey);

            if (alreadyNotified === null) {
                if (memoryCache.has(quakeKey)) {
                    alreadyNotified = true;
                } else {
                    alreadyNotified = false;
                    memoryCache.set(quakeKey, Date.now());
                }
            }

            if (alreadyNotified) {
                skippedAlreadySent.push(quakeKey);
                continue;
            }

            const broadcastResult = await telegram.broadcastAlert(eq);
            alertsSent.push({
                id: eq.id,
                location: eq.location,
                mag: eq.mag,
                date: eq.date,
                coordinatesDMS: eq.coordinatesDMS,
                telegramStatus: broadcastResult
            });

            console.log(`[Cron] Bildirim gönderildi: M ${eq.mag} — ${eq.location}`);
        }

        const executionDuration = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            durationMs: executionDuration,
            settings: {
                ...activeFilters,
                windowMinutes: maxAgeMinutes
            },
            stats: {
                totalScanned: allQuakes.length,
                candidatesFound: candidates.length,
                alertsSentCount: alertsSent.length,
                skippedCount: skippedAlreadySent.length
            },
            alertsSent
        });

    } catch (error) {
        console.error('[Cron] Hata oluştu:', error);
        return res.status(500).json({
            success: false,
            error: 'Deprem kontrolü sırasında hata oluştu',
            message: error.message
        });
    }
};
