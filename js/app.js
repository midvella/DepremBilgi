
const App = {
    earthquakes: [],
    filteredEarthquakes: [],
    currentFilter: {
        minMag: 0,
        maxMag: 10,
        source: 'all',
        search: '',
        sort: 'date-desc'
    },
    refreshInterval: null,
    lastUpdate: null,
    isLoading: false,
    soundEnabled: true,
    knownQuakeIds: new Set(),

    API: {
        KANDILLI: 'https://api.orhanaydogdu.com.tr/deprem/kandilli/live',
        AFAD: 'https://api.orhanaydogdu.com.tr/deprem/afad/live',
        USGS: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
        EMSC: 'https://www.seismicportal.eu/fdsnws/event/1/query?limit=100&format=json&minmag=2.0&orderby=time',
        BACKEND_FALLBACK: '/api/earthquakes'
    },

    async init() {
        this.showLoading();
        this.setupEventListeners();
        Charts.init();
        EarthquakeMap.init();

        await this.fetchAllData();
        this.startAutoRefresh();
        this.updateStats();
        this.animateCounters();
    },

    async fetchAllData() {
        this.isLoading = true;
        this.showLoading();

        try {
            const results = await Promise.allSettled([
                this.fetchKandilli(),
                this.fetchAFAD(),
                this.fetchUSGS(),
                this.fetchEMSC()
            ]);

            const allEarthquakes = [];

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    allEarthquakes.push(...result.value);
                }
            });

            if (allEarthquakes.length === 0) {
                try {
                    const fallbackRes = await fetch(this.API.BACKEND_FALLBACK);
                    if (fallbackRes.ok) {
                        const fallbackData = await fallbackRes.json();
                        if (fallbackData?.earthquakes?.length) {
                            allEarthquakes.push(...fallbackData.earthquakes);
                        }
                    }
                } catch (e) {
                    console.warn('Backend fallback fetch hatası:', e);
                }
            }

            this.earthquakes = this.deduplicateEarthquakes(allEarthquakes);
            this.earthquakes.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (this.knownQuakeIds.size > 0 && this.earthquakes.length > 0) {
                const newest = this.earthquakes[0];
                if (!this.knownQuakeIds.has(newest.id) && newest.mag >= 4.0) {
                    this.playAlertSound(newest.mag);
                }
            }
            this.earthquakes.forEach(eq => this.knownQuakeIds.add(eq.id));

            this.applyFilters();
            this.lastUpdate = new Date();
            this.updateLastUpdateTime();
            this.updateSourceStatus(results);

        } catch (error) {
            console.error('Veri çekme hatası:', error);
            this.showError('Veri yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.');
        }

        this.isLoading = false;
        this.hideLoading();
    },

    async fetchKandilli() {
        try {
            const response = await fetch(this.API.KANDILLI);
            const data = await response.json();

            if (!data.status || !data.result) return [];

            return data.result.map(eq => ({
                id: eq.earthquake_id,
                mag: eq.mag,
                depth: eq.depth || 0,
                lat: eq.geojson.coordinates[1],
                lng: eq.geojson.coordinates[0],
                location: eq.title,
                city: eq.location_properties?.epiCenter?.name || this.extractCity(eq.title),
                date: eq.date_time + '+03:00',
                source: 'Kandilli',
                sourceIcon: '🔬',
                closestCity: eq.location_properties?.closestCity?.name || '',
                closestCityDistance: eq.location_properties?.closestCity?.distance || 0
            }));
        } catch (error) {
            console.warn('Kandilli API hatası:', error);
            return [];
        }
    },

    async fetchAFAD() {
        try {
            const response = await fetch(this.API.AFAD);
            const data = await response.json();

            if (!data.status || !data.result) return [];

            return data.result.map(eq => ({
                id: 'afad_' + eq.earthquake_id,
                mag: eq.mag,
                depth: eq.depth || 0,
                lat: eq.geojson.coordinates[1],
                lng: eq.geojson.coordinates[0],
                location: eq.title,
                city: eq.location_properties?.epiCenter?.name || this.extractCity(eq.title),
                date: eq.date_time + '+03:00',
                source: 'AFAD',
                sourceIcon: '🏛️',
                closestCity: eq.location_properties?.closestCity?.name || '',
                closestCityDistance: eq.location_properties?.closestCity?.distance || 0
            }));
        } catch (error) {
            console.warn('AFAD API hatası:', error);
            return [];
        }
    },

    async fetchUSGS() {
        try {
            const response = await fetch(this.API.USGS);
            const data = await response.json();

            if (!data.features) return [];

            return data.features.map(f => ({
                id: 'usgs_' + f.id,
                mag: f.properties.mag,
                depth: f.geometry.coordinates[2] || 0,
                lat: f.geometry.coordinates[1],
                lng: f.geometry.coordinates[0],
                location: f.properties.place || 'Bilinmiyor',
                city: this.extractUSGSRegion(f.properties.place),
                date: new Date(f.properties.time).toISOString(),
                source: 'USGS',
                sourceIcon: '🌍',
                tsunami: f.properties.tsunami === 1,
                felt: f.properties.felt,
                alert: f.properties.alert,
                url: f.properties.url
            }));
        } catch (error) {
            console.warn('USGS API hatası:', error);
            return [];
        }
    },

    async fetchEMSC() {
        try {
            const response = await fetch(this.API.EMSC);
            const data = await response.json();

            if (!data.features) return [];

            return data.features.map(f => ({
                id: 'emsc_' + f.id,
                mag: f.properties.mag,
                depth: f.properties.depth || 0,
                lat: f.properties.lat,
                lng: f.properties.lon,
                location: f.properties.flynn_region || 'Bilinmiyor',
                city: f.properties.flynn_region || '',
                date: f.properties.time,
                source: 'EMSC',
                sourceIcon: '🇪🇺',
                url: f.properties.source_catalog
            }));
        } catch (error) {
            console.warn('EMSC API hatası:', error);
            return [];
        }
    },

    deduplicateEarthquakes(earthquakes) {
        const unique = [];
        const seen = new Set();

        earthquakes.forEach(eq => {
            const key = `${eq.mag.toFixed(1)}_${eq.lat.toFixed(2)}_${eq.lng.toFixed(2)}_${new Date(eq.date).getTime()}`;
            const roundedKey = `${Math.round(eq.mag)}_${eq.lat.toFixed(1)}_${eq.lng.toFixed(1)}`;

            let isDuplicate = false;
            for (const u of unique) {
                const timeDiff = Math.abs(new Date(eq.date) - new Date(u.date));
                const latDiff = Math.abs(eq.lat - u.lat);
                const lngDiff = Math.abs(eq.lng - u.lng);
                const magDiff = Math.abs(eq.mag - u.mag);

                if (timeDiff < 120000 && latDiff < 0.15 && lngDiff < 0.15 && magDiff < 0.5) {
                    isDuplicate = true;
                    if (!u.sources) u.sources = [u.source];
                    if (!u.sources.includes(eq.source)) u.sources.push(eq.source);
                    break;
                }
            }

            if (!isDuplicate) {
                unique.push(eq);
            }
        });

        return unique;
    },

    extractCity(title) {
        if (!title) return 'Bilinmiyor';
        const match = title.match(/\(([^)]+)\)/);
        if (match) {
            return match[1].charAt(0) + match[1].slice(1).toLowerCase();
        }
        return title.charAt(0) + title.slice(1).toLowerCase();
    },

    extractUSGSRegion(place) {
        if (!place) return '';
        const parts = place.split(', ');
        return parts[parts.length - 1] || place;
    },

    applyFilters() {
        let filtered = [...this.earthquakes];

        filtered = filtered.filter(eq =>
            eq.mag >= this.currentFilter.minMag && eq.mag <= this.currentFilter.maxMag
        );

        if (this.currentFilter.source !== 'all') {
            filtered = filtered.filter(eq =>
                eq.source.toLowerCase() === this.currentFilter.source.toLowerCase()
            );
        }

        if (this.currentFilter.search) {
            const search = this.currentFilter.search.toLowerCase();
            filtered = filtered.filter(eq =>
                eq.location.toLowerCase().includes(search) ||
                (eq.city && eq.city.toLowerCase().includes(search))
            );
        }

        switch (this.currentFilter.sort) {
            case 'date-desc':
                filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'date-asc':
                filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'mag-desc':
                filtered.sort((a, b) => b.mag - a.mag);
                break;
            case 'mag-asc':
                filtered.sort((a, b) => a.mag - b.mag);
                break;
            case 'depth-desc':
                filtered.sort((a, b) => b.depth - a.depth);
                break;
        }

        this.filteredEarthquakes = filtered;
        this.renderEarthquakeList(filtered);
        EarthquakeMap.updateMarkers(filtered);
        Charts.updateAll(filtered);
        this.updateStats();
    },

    renderEarthquakeList(earthquakes) {
        const container = document.getElementById('earthquake-list');
        if (!container) return;

        if (earthquakes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <p>Filtrelere uygun deprem bulunamadı</p>
                </div>
            `;
            return;
        }

        container.innerHTML = earthquakes.map((eq, index) => {
            const color = Utils.getMagnitudeColor(eq.mag);
            const timeAgo = Utils.timeAgo(eq.date);
            const timeStr = Utils.formatTime(eq.date);
            const pulseClass = eq.mag >= 4.0 ? 'list-item-alert' : '';

            return `
                <div class="earthquake-item ${pulseClass}" 
                     data-index="${index}"
                     onclick="App.selectEarthquake(${index})"
                     style="animation-delay: ${index * 0.03}s">
                    <div class="eq-mag-badge" style="background: ${color}20; border: 2px solid ${color}">
                        <span style="color: ${color}">${eq.mag.toFixed(1)}</span>
                    </div>
                    <div class="eq-info">
                        <div class="eq-location">${eq.location}</div>
                        <div class="eq-meta">
                            <span class="eq-time">🕐 ${timeStr}</span>
                            <span class="eq-depth">📏 ${eq.depth} km</span>
                            <span class="eq-source">${eq.sourceIcon} ${eq.source}</span>
                        </div>
                    </div>
                    <div class="eq-time-ago">${timeAgo}</div>
                </div>
            `;
        }).join('');

        const countEl = document.getElementById('result-count');
        if (countEl) {
            countEl.textContent = `${earthquakes.length} deprem`;
        }
    },

    selectEarthquake(index) {
        const eq = this.filteredEarthquakes[index];
        if (!eq) return;

        this.showDetail(eq);
        EarthquakeMap.focusEarthquake(eq);

        document.querySelectorAll('.earthquake-item').forEach(el => el.classList.remove('selected'));
        const items = document.querySelectorAll('.earthquake-item');
        if (items[index]) items[index].classList.add('selected');
    },

    showDetail(eq) {
        const panel = document.getElementById('detail-panel');
        if (!panel) return;

        const coordStr = Utils.formatCoordinates(eq.lat, eq.lng);
        const timeStr = Utils.formatDate(eq.date);
        const timeAgo = Utils.timeAgo(eq.date);
        const color = Utils.getMagnitudeColor(eq.mag);
        const depthCategory = Utils.getDepthCategory(eq.depth);
        const magLabel = Utils.getMagnitudeLabel(eq.mag);
        const mapsUrl = Utils.getGoogleMapsUrl(eq.lat, eq.lng);
        const sourcesStr = eq.sources ? eq.sources.join(' + ') : eq.source;

        panel.innerHTML = `
            <div class="detail-close-bar">
                <button type="button" class="detail-close-btn" onclick="App.closeDetailPanel()" aria-label="Kapat">
                    ✕ Kapat
                </button>
            </div>
            <div class="detail-content" style="border-top: 3px solid ${color}">
                <div class="detail-header">
                    <div class="detail-mag" style="background: ${color}; box-shadow: 0 0 30px ${color}44">
                        ${eq.mag.toFixed(1)}
                    </div>
                    <div>
                        <h3 class="detail-title">${eq.location}</h3>
                        <span class="detail-label" style="color: ${color}">${magLabel} Deprem</span>
                    </div>
                </div>

                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-icon">🕐</span>
                        <div>
                            <span class="detail-key">Tarih & Saat</span>
                            <span class="detail-value">${timeStr}</span>
                            <span class="detail-sub">${timeAgo}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">📏</span>
                        <div>
                            <span class="detail-key">Derinlik</span>
                            <span class="detail-value">${eq.depth} km</span>
                            <span class="detail-sub">${depthCategory}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">🌐</span>
                        <div>
                            <span class="detail-key">Koordinat</span>
                            <span class="detail-value">${coordStr}</span>
                            <span class="detail-sub">${eq.lat.toFixed(4)}°, ${eq.lng.toFixed(4)}°</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <span class="detail-icon">🏢</span>
                        <div>
                            <span class="detail-key">Kaynak</span>
                            <span class="detail-value">${sourcesStr}</span>
                        </div>
                    </div>
                    ${eq.closestCity ? `
                    <div class="detail-item">
                        <span class="detail-icon">🏙️</span>
                        <div>
                            <span class="detail-key">En Yakın Şehir</span>
                            <span class="detail-value">${eq.closestCity}</span>
                            <span class="detail-sub">${eq.closestCityDistance ? (eq.closestCityDistance / 1000).toFixed(1) + ' km' : ''}</span>
                        </div>
                    </div>` : ''}
                    ${eq.tsunami ? `
                    <div class="detail-item tsunami-alert">
                        <span class="detail-icon">🌊</span>
                        <div>
                            <span class="detail-key">Tsunami Uyarısı</span>
                            <span class="detail-value" style="color: #ff2d2d">EVET</span>
                        </div>
                    </div>` : ''}
                </div>

                <div class="detail-actions">
                    <a href="${mapsUrl}" target="_blank" class="btn btn-primary">
                        🗺️ Google Maps'te Aç
                    </a>
                    ${eq.url ? `<a href="${eq.url}" target="_blank" class="btn btn-secondary">🔗 Detaylı Bilgi</a>` : ''}
                </div>
            </div>
        `;

        const backdrop = document.getElementById('detail-backdrop');
        if (backdrop) backdrop.classList.add('active');
        panel.classList.add('active');
    },

    updateStats() {
        const eqs = this.filteredEarthquakes;

        const totalEl = document.getElementById('stat-total');
        const maxMagEl = document.getElementById('stat-max-mag');
        const avgMagEl = document.getElementById('stat-avg-mag');
        const avgDepthEl = document.getElementById('stat-avg-depth');

        if (totalEl) totalEl.setAttribute('data-target', eqs.length);
        if (maxMagEl) {
            const max = eqs.length > 0 ? Math.max(...eqs.map(e => e.mag)) : 0;
            maxMagEl.setAttribute('data-target', max.toFixed(1));
        }
        if (avgMagEl) {
            const avg = eqs.length > 0 ? (eqs.reduce((s, e) => s + e.mag, 0) / eqs.length) : 0;
            avgMagEl.setAttribute('data-target', avg.toFixed(1));
        }
        if (avgDepthEl) {
            const avg = eqs.length > 0 ? (eqs.reduce((s, e) => s + e.depth, 0) / eqs.length) : 0;
            avgDepthEl.setAttribute('data-target', avg.toFixed(1));
        }

        this.animateCounters();
    },

    animateCounters() {
        document.querySelectorAll('.stat-number').forEach(el => {
            const target = parseFloat(el.getAttribute('data-target')) || 0;
            const isDecimal = String(target).includes('.');
            let current = 0;
            const step = target / 40;
            const timer = setInterval(() => {
                current += step;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                el.textContent = isDecimal ? current.toFixed(1) : Math.floor(current);
            }, 25);
        });
    },

    showLoading() {
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.classList.add('active');
    },

    hideLoading() {
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.classList.remove('active');
    },

    showError(message) {
        const el = document.getElementById('error-toast');
        if (el) {
            el.textContent = message;
            el.classList.add('active');
            setTimeout(() => el.classList.remove('active'), 5000);
        }
    },

    updateLastUpdateTime() {
        const el = document.getElementById('last-update');
        if (el && this.lastUpdate) {
            el.textContent = `Son güncelleme: ${this.lastUpdate.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })}`;
        }
    },

    updateSourceStatus(results) {
        const names = ['kandilli', 'afad', 'usgs', 'emsc'];
        results.forEach((result, i) => {
            const dot = document.getElementById(`status-${names[i]}`);
            if (dot) {
                dot.className = result.status === 'fulfilled' && result.value && result.value.length > 0
                    ? 'status-dot online'
                    : 'status-dot offline';
            }
        });
    },

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.fetchAllData();
        }, 60000);
    },

    manualRefresh() {
        this.fetchAllData();
        const btn = document.getElementById('refresh-btn');
        if (btn) {
            btn.classList.add('spinning');
            setTimeout(() => btn.classList.remove('spinning'), 1000);
        }
    },

    setupEventListeners() {
        const magSlider = document.getElementById('mag-filter');
        if (magSlider) {
            magSlider.addEventListener('input', (e) => {
                this.currentFilter.minMag = parseFloat(e.target.value);
                document.getElementById('mag-filter-value').textContent = `M ${e.target.value}+`;
                this.applyFilters();
            });
        }

        const sourceFilter = document.getElementById('source-filter');
        if (sourceFilter) {
            sourceFilter.addEventListener('change', (e) => {
                this.currentFilter.source = e.target.value;
                this.applyFilters();
            });
        }

        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.currentFilter.search = e.target.value;
                this.applyFilters();
            }, 300));
        }

        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.currentFilter.sort = e.target.value;
                this.applyFilters();
            });
        }

        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.manualRefresh());
        }

        const closeDetail = document.getElementById('close-detail');
        if (closeDetail) {
            closeDetail.addEventListener('click', () => {
                document.getElementById('detail-panel').classList.remove('active');
            });
        }

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });

        const soundBtn = document.getElementById('sound-btn');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                this.soundEnabled = !this.soundEnabled;
                soundBtn.textContent = this.soundEnabled ? '🔔' : '🔕';
                soundBtn.title = this.soundEnabled ? 'Sesli Bildirim (Açık)' : 'Sesli Bildirim (Kapalı)';
                if (this.soundEnabled) this.playAlertSound(3.5);
            });
        }

        this.setupTelegramModal();

        // ESC tuşu ile açık olan tüm panelleri ve modalları kapat
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeDetailPanel();
                const tgModal = document.getElementById('telegram-modal');
                if (tgModal) tgModal.classList.remove('active');
            }
        });

        const detailBackdrop = document.getElementById('detail-backdrop');
        if (detailBackdrop) {
            detailBackdrop.addEventListener('click', () => this.closeDetailPanel());
        }

        window.addEventListener('resize', Utils.debounce(() => {
            EarthquakeMap.invalidateSize();
        }, 200));
    },

    playAlertSound(mag = 4.0) {
        if (!this.soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = mag >= 5.0 ? 'sawtooth' : 'sine';
            const freq = mag >= 6.0 ? 987.77 : (mag >= 5.0 ? 784 : 587.33);
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(261.63, ctx.currentTime + 0.5);

            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch {
        }
    },

    setupTelegramModal() {
        const modal = document.getElementById('telegram-modal');
        const openBtn = document.getElementById('telegram-modal-btn');
        const closeBtn = document.getElementById('close-telegram-modal');

        if (openBtn && modal) {
            openBtn.addEventListener('click', () => modal.classList.add('active'));
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        }
    },

    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');
        document.getElementById(tabId)?.classList.add('active');

        if (tabId === 'tab-map') {
            setTimeout(() => EarthquakeMap.invalidateSize(), 100);
        }
    },

    closeDetailPanel() {
        const panel = document.getElementById('detail-panel');
        if (panel) panel.classList.remove('active');
        const backdrop = document.getElementById('detail-backdrop');
        if (backdrop) backdrop.classList.remove('active');
        if (typeof EarthquakeMap !== 'undefined' && EarthquakeMap.selectedMarker) {
            EarthquakeMap.selectedMarker.setStyle({ weight: 2 });
            EarthquakeMap.selectedMarker = null;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
