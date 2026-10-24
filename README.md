# 🌍 Deprem Bilgi Sistemi & Telegram Anlık Bildirim Botu

Türkiye ve dünya genelindeki sismik hareketleri **4 farklı güvenilir kaynaktan (Kandilli Rasathanesi, AFAD, USGS, EMSC)** toplayan, mükerrer kayıtları temizleyen, interaktif harita & istatistik paneli sunan ve eşik değerini aşan depremleri **Telegram üzerinden anlık alarm olarak ileten** yeni nesil deprem bilgi sistemi.

---

## 🌟 Öne Çıkan Özellikler

- **🛡️ 4 Güvenilir Kaynak Entegrasyonu:**
  - 🔬 **Kandilli Rasathanesi** (Boğaziçi Üniversitesi)
  - 🏛️ **AFAD** (Afet ve Acil Durum Yönetimi Başkanlığı)
  - 🌍 **USGS** (Amerika Birleşik Devletleri Jeolojik Araştırmalar Kurumu)
  - 🇪🇺 **EMSC** (Avrupa-Akdeniz Sismoloji Merkezi)
- **🤖 Telegram Anlık Alarm Botu:**
  - **Derece, Dakika, Saniye (DMS)** formatında tam koordinatlar (Örn: `38° 25' 25" K, 27° 08' 34" D`)
  - Konum, il, ilçe ve en yakın yerleşim merkezine olan kuş uçuşu mesafe
  - Büyüklük (Richter), derinlik, Türkiye Saati (TSİ) ile tam saat ve tarih
  - Tek tıkla **Google Haritalar** ve **OpenStreetMap** yönlendirmesi
  - Tsunami riski kontrolü ve görsel şiddet seviyesi rozetleri (🚨 / ⚠️ / 🟡 / 🟢)
- **⏰ 5 Dakikalık Otomatik Vercel Cron:**
  - Arka planda sunucusuz (serverless) olarak her 5 dakikada bir kontrol eder.
  - Sadece belirlenen eşik değerinin (varsayılan: `M 3.0+`) üzerindeki yeni depremleri bildirir.
  - Akıllı önbellek ve zaman penceresi ile aynı deprem için mükerrer bildirim atmaz.
- **💬 İnteraktif Telegram Komutları:**
  - `/son` — En son gerçekleşen depremin tüm detayları
  - `/depremler` — Son 5 depremin özeti
  - `/buyuk` — Son 24 saatteki M 4.0 ve üzeri depremler
  - `/durum` — Kandilli, AFAD, USGS ve EMSC sunucu sağlık raporu
  - `/start` — Chat ID öğrenme ve menü
- **🗺️ Canlı Web Arayüzü:**
  - Leaflet tabanlı dinamik harita (Karanlık, Aydınlık ve Uydu katmanları)
  - Büyüklüğe göre nabız (pulse) animasyonlu renkli sismik işaretçiler
  - Chart.js ile 4 farklı analiz grafiği (Büyüklük, Saatlik aktivite, Derinlik, Bölgesel dağılım)
  - Konum arama, büyüklük filtresi (M 0-7+), kaynak filtreleme ve sıralama
  - Web Audio API ile M 4.0+ depremlerde tarayıcıdan sesli uyarı

---

## 📁 Proje Mimarisi

```
deprem-bilgi/
├── api/
│   ├── cron/
│   │   └── check-earthquakes.js   # Vercel Cron servisi (Her 5 dk otomatik çalışır)
│   ├── services/
│   │   └── earthquakeService.js   # 4 kaynaktan veri çeken & temizleyen servis
│   ├── telegram/
│   │   ├── webhook.js             # İnteraktif Telegram bot webhook'u
│   │   └── test.js                # Bot test uç noktası
│   ├── utils/
│   │   ├── geo.js                 # Derece/Dakika (DMS) & mesafe hesaplama
│   │   └── telegram.js            # Telegram HTML mesaj şablonu & API istemcisi
│   └── earthquakes.js             # Birleştirilmiş JSON API rotası (/api/earthquakes)
├── css/
│   └── style.css                  # Dark glassmorphic modern tasarım sistemi
├── js/
│   ├── app.js                     # Ana uygulama & sesli uyarı yöneticisi
│   ├── charts.js                  # Chart.js istatistik grafikleri
│   ├── map.js                     # Leaflet harita yönetimi
│   └── utils.js                   # İstemci tarafı yardımcı fonksiyonlar
├── index.html                     # Ana kullanıcı arayüzü
├── vercel.json                    # Vercel Serverless & Cron yapılandırması
├── package.json
└── .env.example                   # Örnek ortam değişkenleri
```

---

## 🚀 Kurulum & Dağıtım (Vercel)

Sistemi Vercel üzerinde tamamen **ücretsiz** olarak çalıştırabilirsiniz:

### 1. Telegram Botu Oluşturma
1. Telegram'ı açın ve arama kutusuna `@BotFather` yazın.
2. `/newbot` komutunu gönderin.
3. Botunuz için bir isim (örn. `Türkiye Deprem Takip`) ve bir kullanıcı adı (örn. `benim_deprem_botum`) belirleyin.
4. BotFather size bir `HTTP API Token` verecektir (Örn: `7123456789:ABCdefGhIJKlmNo...`). Bu sizin **`TELEGRAM_BOT_TOKEN`** değerinizdir.
5. Botunuza gidin ve **`/start`** butonuna basın (Bu adım şarttır, aksi takdirde bot size mesaj atamaz).

### 2. Chat ID'nizi Öğrenme
- Telegram'da `@userinfobot` botuna herhangi bir mesaj atarak `Id` değerinizi (örn: `123456789`) görebilirsiniz.
- Veya Vercel'e dağıtım yaptıktan sonra botunuza `/start` yazdığınızda botunuz kendi Chat ID'nizi size söyleyecektir.
- Bu sizin **`TELEGRAM_CHAT_ID`** değerinizdir.

### 3. Vercel'e Dağıtım
1. Projeyi GitHub reponuza yükleyin.
2. [Vercel Dashboard](https://vercel.com/new)'a girin ve reponuzu seçin.
3. **Environment Variables** (Ortam Değişkenleri) bölümüne şunları ekleyin:
   - `TELEGRAM_BOT_TOKEN` = `bot_tokeniniz`
   - `TELEGRAM_CHAT_ID` = `chat_id_numaranız`
   - `ALERT_REGION` = `turkey` *(Sadece Türkiye ve çevresindeki depremleri bildirir)*
   - `MIN_MAGNITUDE` = `4.0` *(Örn: Sadece 4.0 ve üzeri depremler için)*
   - `ALERT_LOCATIONS` = `İstanbul,İzmir,Marmara` *(İsteğe bağlı, belirli şehir filtreleri)*
4. **Deploy** butonuna basın.

### 4. Telegram Webhook'unu Aktif Etme (İnteraktif Komutlar İçin)
Botunuzun `/filtre`, `/bolge`, `/ayarlar`, `/son`, `/depremler`, `/durum` gibi komutlara yanıt vermesi için Telegram Webhook'unu tarayıcınızdan tek seferlik tanımlayın:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<VERCEL_PROJE_ADINIZ>.vercel.app/api/telegram/webhook
```

Ekranda `{"ok":true,"result":true,"description":"Webhook was set"}` cevabını gördüyseniz kurulum tamamdır!

### 5. Bot Üzerinden Filtre Değiştirme
Botunuza mesaj göndererek filtreleri istediğiniz an değiştirebilirsiniz:
- `/filtre 4.0` — Bildirim eşiğini M 4.0+ yapar
- `/bolge turkiye` — Sadece Türkiye ve çevresini dinler
- `/bolge dunya` — Tüm dünyadaki depremleri dinler
- `/konum izmir,istanbul` — Belirli şehirleri filtreler
- `/ayarlar` — Aktif filtreleri butonlu kontrol paneliyle gösterir

### 5. Kurulumu Test Etme
Dağıtım tamamlandıktan sonra tarayıcınızdan şu adrese girerek anında test mesajı alabilirsiniz:
```text
https://<VERCEL_PROJE_ADINIZ>.vercel.app/api/telegram/test
```
Telegram'ınıza tüm derece/dakika ve harita detaylarıyla örnek bir test deprem uyarısı düşecektir!

---

## 📱 Telegram Bildirim Örneği

```
🚨🚨 ŞİDDETLİ DEPREM
━━━━━━━━━━━━━━━━━━━━━━
📍 Konum: EGE DENIZI - SEFERIHISAR ACIKLARI (IZMIR)
🏙️ Bölge/İl: İzmir
💥 Büyüklük: M 4.8 (Orta Büyüklükte)
📏 Derinlik: 10.4 km (Sığ)
⏱️ Saat: 15:42:10 (TSİ)
📅 Tarih: 24.10.2026
🌐 Koordinat (DMS):
   └ 38° 25' 09.1" K
   └ 27° 07' 43.3" D
📐 Ondalık: 38.4192, 27.1287
🔬 Kaynak: AFAD, Kandilli Rasathanesi, USGS
🚗 En Yakın Merkez: Seferihisar (~14.2 km)
━━━━━━━━━━━━━━━━━━━━━━
🗺️ Google Haritalar'da Aç | 🌍 OpenStreetMap
```

---

## 🛠️ Yerel Geliştirme (Localhost)

```bash
# Bağımlılıkları yükleyin
npm install

# Vercel CLI ile yerel geliştirme sunucusunu başlatın
npx vercel dev
```

Tarayıcınızda `http://localhost:3000` adresini açarak uygulamayı test edebilirsiniz.
