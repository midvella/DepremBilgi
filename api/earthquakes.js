
const earthquakeService = require('./services/earthquakeService');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const data = await earthquakeService.getAggregatedEarthquakes();
        return res.status(200).json({
            success: true,
            ...data
        });
    } catch (error) {
        console.error('[API earthquakes] Hata:', error);
        return res.status(500).json({
            success: false,
            error: 'Veri toplanırken hata oluştu',
            message: error.message
        });
    }
};
