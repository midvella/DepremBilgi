
const geo = require('./geo');

const fetchFn = typeof fetch !== 'undefined' ? fetch : (() => {
    try {
        return require('node-fetch');
    } catch {
        return null;
    }
})();

function getMagnitudeBadge(mag) {
    if (mag >= 7.0) return { icon: '🚨🚨🚨', title: 'ÇOK ŞİDDETLİ DEPREM (AFET)', level: 'KRİTİK' };
    if (mag >= 6.0) return { icon: '🚨🚨', title: 'ŞİDDETLİ DEPREM', level: 'YÜKSEK' };
    if (mag >= 5.0) return { icon: '⚠️⚠️', title: 'KUVVETLİ DEPREM', level: 'ÖNEMLİ' };
    if (mag >= 4.0) return { icon: '🟡', title: 'ORTA BÜYÜKLÜKTE DEPREM', level: 'DİKKAT' };
    if (mag >= 3.0) return { icon: '🟢', title: 'HAFİF DEPREM', level: 'BİLGİ' };
    return { icon: '⚪', title: 'MİKRO DEPREM', level: 'DÜŞÜK' };
}

function formatTSI(dateStr) {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return { date: '—', time: '—' };

        const trDate = d.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Europe/Istanbul'
        });

        const trTime = d.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Istanbul'
        });

        return { date: trDate, time: trTime };
    } catch {
        return { date: '—', time: '—' };
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatEarthquakeMessage(eq) {
    const badge = getMagnitudeBadge(eq.mag);
    const { date, time } = formatTSI(eq.date);

    const latDMS = eq.latDMS || geo.toDMS(eq.lat, true);
    const lngDMS = eq.lngDMS || geo.toDMS(eq.lng, false);
    const mapsUrl = eq.googleMapsUrl || geo.getGoogleMapsUrl(eq.lat, eq.lng);
    const sources = Array.isArray(eq.sources) && eq.sources.length ? eq.sources.join(', ') : (eq.source || 'Bilinmiyor');

    let msg = `<b>${badge.icon} ${badge.title}</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📍 <b>Konum:</b> <code>${escapeHTML(eq.location || eq.city || 'Bilinmiyor')}</code>\n`;
    if (eq.city && eq.city !== eq.location) {
        msg += `🏙️ <b>Bölge/İl:</b> ${escapeHTML(eq.city)}\n`;
    }
    msg += `💥 <b>Büyüklük:</b> <b>M ${eq.mag.toFixed(1)}</b> (${escapeHTML(eq.magLabel || badge.level)})\n`;
    msg += `📏 <b>Derinlik:</b> <b>${eq.depth} km</b> (${escapeHTML(eq.depthCategory || 'Normal')})\n`;
    msg += `⏱️ <b>Saat:</b> <b>${time}</b> (TSİ)\n`;
    msg += `📅 <b>Tarih:</b> ${date}\n`;
    msg += `🌐 <b>Koordinat (DMS):</b>\n`;
    msg += `   └ <code>${latDMS}</code>\n`;
    msg += `   └ <code>${lngDMS}</code>\n`;
    msg += `📐 <b>Ondalık:</b> <code>${eq.lat}, ${eq.lng}</code>\n`;
    msg += `🔬 <b>Kaynak:</b> ${escapeHTML(sources)}\n`;

    if (eq.closestCity && eq.closestCityDistance) {
        msg += `🚗 <b>En Yakın Merkez:</b> ${escapeHTML(eq.closestCity)} (~${eq.closestCityDistance} km)\n`;
    }

    if (eq.tsunami) {
        msg += `🌊 <b>TSUNAMİ UYARISI:</b> Olası tsunami riski bildirilmiştir!\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🗺️ <a href="${mapsUrl}">Google Haritalar'da Aç</a> | 🌍 <a href="${geo.getOsmUrl(eq.lat, eq.lng)}">OpenStreetMap</a>\n`;

    return msg;
}

async function sendTelegramMessage(botToken, chatId, text, options = {}) {
    if (!botToken || !chatId) {
        console.warn('[Telegram] Token veya Chat ID eksik.');
        return { success: false, error: 'Token veya Chat ID tanımlanmamış' };
    }

    if (!fetchFn) {
        return { success: false, error: 'Fetch bulunamadı' };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const payload = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: options.disableWebPagePreview !== undefined ? options.disableWebPagePreview : false,
        ...options
    };

    try {
        const res = await fetchFn(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!data.ok) {
            console.error('[Telegram] API Hatası:', data.description);
            return { success: false, error: data.description };
        }

        return { success: true, result: data.result };
    } catch (err) {
        console.error('[Telegram] Ağ Hatası:', err.message);
        return { success: false, error: err.message };
    }
}

async function broadcastAlert(earthquake, customToken = null, customChatId = null) {
    const token = customToken || process.env.TELEGRAM_BOT_TOKEN;
    const rawChatIds = customChatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !rawChatIds) {
        return {
            success: false,
            error: 'TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID ortam değişkenleri tanımlı değil.'
        };
    }

    const message = formatEarthquakeMessage(earthquake);
    const chatIds = String(rawChatIds).split(',').map(id => id.trim()).filter(Boolean);

    const inlineKeyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🗺️ Haritada Gör', url: earthquake.googleMapsUrl || geo.getGoogleMapsUrl(earthquake.lat, earthquake.lng) }
                ]
            ]
        }
    };

    const results = [];
    for (const id of chatIds) {
        const res = await sendTelegramMessage(token, id, message, inlineKeyboard);
        results.push({ chatId: id, ...res });
    }

    const allSuccessful = results.every(r => r.success);
    return {
        success: allSuccessful,
        totalSent: results.filter(r => r.success).length,
        results
    };
}

module.exports = {
    formatEarthquakeMessage,
    sendTelegramMessage,
    broadcastAlert,
    getMagnitudeBadge,
    formatTSI
};
