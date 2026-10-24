
const earthquakeService = require('../services/earthquakeService');
const filterService = require('../services/filterService');
const telegram = require('../utils/telegram');
const geo = require('../utils/geo');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).json({
            status: 'ok',
            message: 'Telegram Webhook Aktif. Lütfen Telegram üzerinden mesaj gönderin.'
        });
    }

    const update = req.body;
    if (!update) {
        return res.status(200).send('No update');
    }

    const message = update.message || update.edited_message;
    const callbackQuery = update.callback_query;

    const token = BOT_TOKEN;
    if (!token) {
        console.error('[Webhook] TELEGRAM_BOT_TOKEN tanımlı değil');
        return res.status(200).send('Bot token missing');
    }

    try {
        if (callbackQuery) {
            const chatId = callbackQuery.message?.chat?.id;
            const data = callbackQuery.data;

            if (data === 'cmd_son') {
                await handleSonCommand(token, chatId);
            } else if (data === 'cmd_depremler') {
                await handleDepremlerCommand(token, chatId);
            } else if (data === 'cmd_durum') {
                await handleDurumCommand(token, chatId);
            } else if (data === 'cmd_ayarlar') {
                await handleAyarlarCommand(token, chatId);
            } else if (data?.startsWith('set_mag_')) {
                const mag = parseFloat(data.replace('set_mag_', ''));
                await filterService.updateFilterSettings(chatId, { minMagnitude: mag });
                await telegram.sendTelegramMessage(token, chatId, `✅ <b>Bildirim Eşiği M ${mag.toFixed(1)}+ olarak ayarlandı!</b>`);
                await handleAyarlarCommand(token, chatId);
            } else if (data?.startsWith('set_reg_')) {
                const region = data.replace('set_reg_', '');
                await filterService.updateFilterSettings(chatId, { region });
                const regTitle = region === 'turkey' ? '🇹🇷 Sadece Türkiye' : (region === 'global' ? '🌍 Tüm Dünya' : region.toUpperCase());
                await telegram.sendTelegramMessage(token, chatId, `✅ <b>Bölge Filtresi: ${regTitle} olarak güncellendi!</b>`);
                await handleAyarlarCommand(token, chatId);
            }

            const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
            await fetchFn(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callbackQuery.id })
            });

            return res.status(200).send('OK');
        }

        if (!message || !message.text) {
            return res.status(200).send('Ignored');
        }

        const chatId = message.chat.id;
        const text = message.text.trim();
        const parts = text.split(' ');
        const rawCmd = parts[0].toLowerCase().replace('@' + (process.env.TELEGRAM_BOT_USERNAME || ''), '');
        const param = parts.slice(1).join(' ').trim();

        switch (rawCmd) {
            case '/start':
                await handleStartCommand(token, chatId, message.chat);
                break;

            case '/son':
                await handleSonCommand(token, chatId);
                break;

            case '/depremler':
            case '/liste':
                await handleDepremlerCommand(token, chatId);
                break;

            case '/buyuk':
                await handleBuyukCommand(token, chatId);
                break;

            case '/filtre':
            case '/esik':
                if (param) {
                    const parsedMag = parseFloat(param.replace(',', '.'));
                    if (!isNaN(parsedMag) && parsedMag >= 0 && parsedMag <= 10) {
                        await filterService.updateFilterSettings(chatId, { minMagnitude: parsedMag });
                        await telegram.sendTelegramMessage(
                            token,
                            chatId,
                            `✅ <b>Bildirim Eşiği Güncellendi!</b>\nArtık sadece <b>M ${parsedMag.toFixed(1)} ve üzeri</b> depremlerde bildirim alacaksınız.`
                        );
                    } else {
                        await telegram.sendTelegramMessage(token, chatId, '⚠️ Lütfen geçerli bir büyüklük girin. Örnek: <code>/filtre 4.0</code>');
                    }
                } else {
                    await handleAyarlarCommand(token, chatId);
                }
                break;

            case '/bolge':
                if (param) {
                    const p = param.toLowerCase();
                    const region = (p === 'turkiye' || p === 'türkiye' || p === 'tr') ? 'turkey' : (p === 'dunya' || p === 'dünya' ? 'global' : p);
                    await filterService.updateFilterSettings(chatId, { region });
                    const regionName = region === 'turkey' ? '🇹🇷 Sadece Türkiye ve Çevresi' : (region === 'global' ? '🌍 Tüm Dünya' : region.toUpperCase());
                    await telegram.sendTelegramMessage(
                        token,
                        chatId,
                        `✅ <b>Bölge Filtresi Güncellendi!</b>\nBildirim bölgesi: <b>${regionName}</b>`
                    );
                } else {
                    await handleAyarlarCommand(token, chatId);
                }
                break;

            case '/konum':
                if (param) {
                    const cities = param.split(',').map(c => c.trim()).filter(Boolean);
                    await filterService.updateFilterSettings(chatId, { locations: cities });
                    await telegram.sendTelegramMessage(
                        token,
                        chatId,
                        `✅ <b>Şehir/Konum Filtresi Güncellendi!</b>\nTakip edilen yerler: <code>${cities.join(', ')}</code>`
                    );
                } else {
                    await filterService.updateFilterSettings(chatId, { locations: [] });
                    await telegram.sendTelegramMessage(token, chatId, '✅ Şehir/konum filtresi temizlendi (tüm yerler geçerli).');
                }
                break;

            case '/ayarlar':
            case '/filtreler':
                await handleAyarlarCommand(token, chatId);
                break;

            case '/sifirla':
                await filterService.updateFilterSettings(chatId, {
                    minMagnitude: 4.0,
                    region: 'turkey',
                    locations: [],
                    maxDepth: null
                });
                await telegram.sendTelegramMessage(token, chatId, '🔄 <b>Filtreler sıfırlandı:</b> Türkiye geneli, M 4.0+');
                await handleAyarlarCommand(token, chatId);
                break;

            case '/durum':
            case '/status':
                await handleDurumCommand(token, chatId);
                break;

            case '/yardim':
            case '/help':
                await handleHelpCommand(token, chatId);
                break;

            default:
                if (text.startsWith('/')) {
                    await telegram.sendTelegramMessage(
                        token,
                        chatId,
                        `❓ Bilinmeyen komut: <code>${text}</code>\nKullanabileceğiniz komutları görmek için /yardim veya /ayarlar yazabilirsiniz.`
                    );
                }
                break;
        }

        return res.status(200).send('OK');

    } catch (err) {
        console.error('[Webhook] İşleme hatası:', err);
        return res.status(200).send('Error processed');
    }
};

async function handleStartCommand(token, chatId, chat) {
    const name = chat.first_name ? ` ${chat.first_name}` : '';
    const welcome = `
👋 <b>Merhaba${name}! Deprem Bilgi Sistemi Botuna Hoş Geldiniz.</b>

Bu bot, Türkiye (Kandilli Rasathanesi & AFAD) ile dünya (USGS & EMSC) sismik verilerini anlık takip eder ve dilediğiniz filtrelemelerle cebinize iletir.

⚙️ <b>Özelleştirilebilir Filtreler:</b>
• Sadece Türkiye'deki <b>M 4.0+</b> depremler mi?
  Yazmanız yeterli: <code>/filtre 4.0</code> veya <code>/bolge turkiye</code>
• Tüm ayarları görmek için: <b>/ayarlar</b>

📋 <b>Hızlı Komutlar:</b>
▫️ /son — En son gerçekleşen depremin tam detayları (DMS, derinlik, harita)
▫️ /depremler — Son 5 deprem özeti
▫️ /buyuk — Son 24 saatteki M 4.0+ büyüklüğündeki depremler
▫️ /ayarlar — Bildirim eşiği ve bölge filtrelerini düzenle
▫️ /durum — Sismik API sunucularının sağlık raporu
    `.trim();

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔴 En Son Deprem (/son)', callback_data: 'cmd_son' },
                    { text: '📋 Son Depremler', callback_data: 'cmd_depremler' }
                ],
                [
                    { text: '⚙️ Bildirim Ayarları', callback_data: 'cmd_ayarlar' },
                    { text: '📊 Sistem Durumu', callback_data: 'cmd_durum' }
                ]
            ]
        }
    };

    await telegram.sendTelegramMessage(token, chatId, welcome, keyboard);
}

async function handleAyarlarCommand(token, chatId) {
    const settings = await filterService.getEffectiveFilterSettings(chatId);

    const regionTitle = settings.region === 'turkey'
        ? '🇹🇷 Sadece Türkiye & Yakın Çevresi'
        : (settings.region === 'global' ? '🌍 Tüm Dünya' : settings.region.toUpperCase());

    const locText = settings.locations && settings.locations.length > 0
        ? settings.locations.join(', ')
        : 'Tümü (Sınırlama yok)';

    let text = `<b>⚙️ AKTİF BİLDİRİM FİLTRELERİNİZ</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💥 <b>Minimum Büyüklük:</b> <b>M ${settings.minMagnitude.toFixed(1)}+</b>\n`;
    text += `🎯 <b>Bölge:</b> ${regionTitle}\n`;
    text += `📍 <b>Özel Konumlar:</b> <code>${locText}</code>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `<i>Aşağıdaki butonlara tıklayarak filtreleri anında değiştirebilirsiniz:</i>`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: `${settings.region === 'turkey' ? '✅ ' : ''}🇹🇷 Sadece Türkiye`, callback_data: 'set_reg_turkey' },
                    { text: `${settings.region === 'global' ? '✅ ' : ''}🌍 Tüm Dünya`, callback_data: 'set_reg_global' }
                ],
                [
                    { text: `${settings.minMagnitude === 3.0 ? '✅ ' : ''}M 3.0+`, callback_data: 'set_mag_3.0' },
                    { text: `${settings.minMagnitude === 3.5 ? '✅ ' : ''}M 3.5+`, callback_data: 'set_mag_3.5' },
                    { text: `${settings.minMagnitude === 4.0 ? '✅ ' : ''}M 4.0+`, callback_data: 'set_mag_4.0' },
                    { text: `${settings.minMagnitude === 5.0 ? '✅ ' : ''}M 5.0+`, callback_data: 'set_mag_5.0' }
                ],
                [
                    { text: '🌊 Marmara', callback_data: 'set_reg_marmara' },
                    { text: '☀️ Ege', callback_data: 'set_reg_ege' }
                ],
                [
                    { text: '🔴 En Son Deprem', callback_data: 'cmd_son' }
                ]
            ]
        }
    };

    await telegram.sendTelegramMessage(token, chatId, text, keyboard);
}

async function handleSonCommand(token, chatId) {
    await telegram.sendTelegramMessage(token, chatId, '📡 <i>Son deprem verileri çekiliyor...</i>');

    const data = await earthquakeService.getAggregatedEarthquakes();
    if (!data.earthquakes || data.earthquakes.length === 0) {
        return await telegram.sendTelegramMessage(token, chatId, '❌ Şu anda deprem verisi bulunamadı veya sunuculara ulaşılamıyor.');
    }

    const latest = data.earthquakes[0];
    const message = telegram.formatEarthquakeMessage(latest);

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🗺️ Google Haritalar', url: latest.googleMapsUrl || geo.getGoogleMapsUrl(latest.lat, latest.lng) },
                    { text: '🔄 Yenile', callback_data: 'cmd_son' }
                ]
            ]
        }
    };

    await telegram.sendTelegramMessage(token, chatId, message, keyboard);
}

async function handleDepremlerCommand(token, chatId) {
    const data = await earthquakeService.getAggregatedEarthquakes();
    if (!data.earthquakes || data.earthquakes.length === 0) {
        return await telegram.sendTelegramMessage(token, chatId, '❌ Deprem verisi bulunamadı.');
    }

    const list = data.earthquakes.slice(0, 5);

    let text = `<b>📋 SON DEPREMLER</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    list.forEach((eq, idx) => {
        const { time } = telegram.formatTSI(eq.date);
        const badge = telegram.getMagnitudeBadge(eq.mag);
        text += `<b>${idx + 1}.</b> ${badge.icon} <b>M ${eq.mag.toFixed(1)}</b> — ${time}\n`;
        text += `   📍 <code>${eq.location}</code>\n`;
        text += `   📏 Derinlik: ${eq.depth} km | 🔬 ${eq.sources ? eq.sources.join(', ') : eq.source}\n`;
        text += `   🌐 ${eq.latDMS || geo.toDMS(eq.lat, true)}, ${eq.lngDMS || geo.toDMS(eq.lng, false)}\n\n`;
    });

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔴 En Son Deprem', callback_data: 'cmd_son' },
                    { text: '🔄 Listeyi Yenile', callback_data: 'cmd_depremler' }
                ]
            ]
        }
    };

    await telegram.sendTelegramMessage(token, chatId, text, keyboard);
}

async function handleBuyukCommand(token, chatId) {
    const data = await earthquakeService.getAggregatedEarthquakes();
    const quakes = data.earthquakes || [];
    const significant = quakes.filter(eq => eq.mag >= 4.0).slice(0, 5);

    if (significant.length === 0) {
        return await telegram.sendTelegramMessage(
            token,
            chatId,
            '✅ <b>İyi haber!</b> Son kayıtlarda <b>M 4.0 ve üzeri</b> sarsıntı tespit edilmedi.'
        );
    }

    let text = `<b>⚠️ M 4.0 VE ÜZERİ HİSSEDİLİR DEPREMLER</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    significant.forEach((eq, idx) => {
        const { date, time } = telegram.formatTSI(eq.date);
        text += `<b>${idx + 1}. 🚨 M ${eq.mag.toFixed(1)}</b> — ${time} (${date})\n`;
        text += `   📍 <b>Konum:</b> ${eq.location}\n`;
        text += `   📏 <b>Derinlik:</b> ${eq.depth} km\n`;
        text += `   🌐 <b>Koordinatlar:</b> <code>${eq.latDMS}, ${eq.lngDMS}</code>\n`;
        text += `   🗺️ <a href="${eq.googleMapsUrl}">Haritada Aç</a>\n\n`;
    });

    await telegram.sendTelegramMessage(token, chatId, text);
}

async function handleDurumCommand(token, chatId) {
    const data = await earthquakeService.getAggregatedEarthquakes();
    const sources = data.sources || {};

    const formatStatus = (s) => s?.status === 'online' ? '🟢 Aktif' : '🔴 Bağlantı Yok';

    let text = `<b>📊 DEPREM BİLGİ SİSTEMİ DURUM RAPORU</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🔬 <b>Kandilli Rasathanesi:</b> ${formatStatus(sources.kandilli)} (${sources.kandilli?.count || 0} veri)\n`;
    text += `🏛️ <b>AFAD:</b> ${formatStatus(sources.afad)} (${sources.afad?.count || 0} veri)\n`;
    text += `🌍 <b>USGS (ABD Jeoloji):</b> ${formatStatus(sources.usgs)} (${sources.usgs?.count || 0} veri)\n`;
    text += `🇪🇺 <b>EMSC (Avrupa-Akdeniz):</b> ${formatStatus(sources.emsc)} (${sources.emsc?.count || 0} veri)\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📦 <b>Toplam Ayrıştırılmış Deprem:</b> ${data.total || 0}\n`;
    text += `⏱️ <b>Sunucu Zamanı:</b> ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} (TSİ)\n`;

    await telegram.sendTelegramMessage(token, chatId, text);
}

async function handleHelpCommand(token, chatId) {
    const text = `
<b>📖 DEPREM BOTU KULLANIM KILAVUZU</b>
━━━━━━━━━━━━━━━━━━━━━━
<b>🔔 Bildirim Filtre Komutları:</b>
• <b>/ayarlar</b> : Aktif eşik ve bölge filtrelerinizi gösterir, butonlarla değiştirebilirsiniz.
• <b>/filtre 4.0</b> : Bildirim eşiğini belirler (örn: 4.0 ve üzeri).
• <b>/bolge turkiye</b> : Sadece Türkiye ve yakın sismik çevresini takip eder.
• <b>/bolge dunya</b> : Küresel tüm sarsıntıları dinler.
• <b>/konum izmir,istanbul</b> : Belirlenen illere göre filtreler.
• <b>/sifirla</b> : Filtreleri varsayılana döndürür.

<b>📡 Deprem Sorgu Komutları:</b>
• <b>/son</b> : Gerçekleşen en son depremi tüm detayları (DMS, derinlik, harita) ile listeler.
• <b>/depremler</b> : Son 5 depremin özetini sunar.
• <b>/buyuk</b> : M 4.0 ve üzeri önemli sarsıntıları filtreler.
• <b>/durum</b> : API sunucularının (Kandilli, AFAD, USGS, EMSC) online durumunu gösterir.
    `.trim();

    await telegram.sendTelegramMessage(token, chatId, text);
}
