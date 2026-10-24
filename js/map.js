
const EarthquakeMap = {
    map: null,
    markers: L.layerGroup(),
    heatLayer: null,
    selectedMarker: null,
    tileLayers: {},
    currentLayer: 'dark',

    init() {
        this.map = L.map('earthquake-map', {
            center: [39.0, 35.0],
            zoom: 6,
            minZoom: 3,
            maxZoom: 18,
            zoomControl: false,
            attributionControl: false,
            worldCopyJump: true, 
            maxBounds: [[-85, -Infinity], [85, Infinity]], 
            maxBoundsViscosity: 1.0
        });

        L.control.zoom({ position: 'bottomright' }).addTo(this.map);

        L.control.attribution({ position: 'bottomleft', prefix: false })
            .addAttribution('© <a href="https://www.openstreetmap.org/">OSM</a> | <a href="https://carto.com/">CARTO</a>')
            .addTo(this.map);

        const darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
        });

        const lightTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
        });

        const satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 18
        });

        this.tileLayers = {
            dark: darkTile,
            light: lightTile,
            satellite: satelliteTile
        };

        this.currentLayer = 'dark';
        darkTile.addTo(this.map);

        this.addCustomToolbar();

        this.markers.addTo(this.map);
        this.addTurkeyBorder();
    },

    addCustomToolbar() {
        const toolbar = L.control({ position: 'topright' });
        toolbar.onAdd = () => {
            const container = L.DomUtil.create('div', 'map-custom-toolbar');
            container.innerHTML = `
                <div class="map-toolbar-group layers-group" title="Harita Görünümü Seçin">
                    <button type="button" class="map-toolbar-btn active" data-layer="dark" aria-label="Karanlık Harita">
                        <span class="btn-icon-inner">🌑</span>
                        <span class="btn-label-inner">Karanlık</span>
                    </button>
                    <button type="button" class="map-toolbar-btn" data-layer="light" aria-label="Aydınlık Harita">
                        <span class="btn-icon-inner">☀️</span>
                        <span class="btn-label-inner">Aydınlık</span>
                    </button>
                    <button type="button" class="map-toolbar-btn" data-layer="satellite" aria-label="Uydu Haritası">
                        <span class="btn-icon-inner">🛰️</span>
                        <span class="btn-label-inner">Uydu</span>
                    </button>
                </div>
                <div class="map-toolbar-group nav-group">
                    <button type="button" class="map-toolbar-btn nav-action-btn" id="btn-map-turkey" title="Türkiye'ye Odaklan">
                        <span class="btn-icon-inner">🇹🇷</span>
                        <span class="btn-label-inner">Türkiye</span>
                    </button>
                    <button type="button" class="map-toolbar-btn nav-action-btn" id="btn-map-world" title="Tüm Dünyayı Gör">
                        <span class="btn-icon-inner">🌍</span>
                        <span class="btn-label-inner">Dünya</span>
                    </button>
                </div>
            `;

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            container.querySelectorAll('[data-layer]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const layerKey = btn.getAttribute('data-layer');
                    this.switchTileLayer(layerKey);
                    container.querySelectorAll('[data-layer]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            container.querySelector('#btn-map-turkey')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.map.flyTo([39.0, 35.0], 6, { duration: 1.2 });
            });

            container.querySelector('#btn-map-world')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.map.flyTo([30.0, 20.0], 3, { duration: 1.5 });
            });

            return container;
        };
        toolbar.addTo(this.map);
    },

    switchTileLayer(key) {
        if (this.currentLayer === key) return;

        if (this.tileLayers[this.currentLayer] && this.map.hasLayer(this.tileLayers[this.currentLayer])) {
            this.map.removeLayer(this.tileLayers[this.currentLayer]);
        }

        if (this.tileLayers[key]) {
            this.tileLayers[key].addTo(this.map);
            this.currentLayer = key;
        }
    },

    addTurkeyBorder() {
        const turkeyBounds = [
            [35.8, 25.5],
            [42.2, 44.8]
        ];

        L.rectangle(turkeyBounds, {
            color: 'rgba(255, 107, 53, 0.5)',
            weight: 2,
            fillColor: 'transparent',
            fillOpacity: 0,
            dashArray: '8, 6',
            interactive: false
        }).addTo(this.map);
    },

    updateMarkers(earthquakes) {
        this.markers.clearLayers();

        earthquakes.forEach((eq) => {
            const lat = eq.lat;
            const lng = eq.lng;
            const mag = eq.mag;
            const color = Utils.getMagnitudeColor(mag);
            const radius = Utils.getMagnitudeRadius(mag);
            const pulseClass = Utils.getPulseClass(mag);

            const lngOffsets = [0, -360, 360];

            lngOffsets.forEach(offset => {
                const markerLat = lat;
                const markerLng = lng + offset;

                const marker = L.circleMarker([markerLat, markerLng], {
                    radius: radius,
                    fillColor: color,
                    color: color,
                    weight: 2,
                    opacity: 0.9,
                    fillOpacity: 0.55,
                    className: pulseClass
                });

                const popupContent = this.createPopupContent(eq);
                marker.bindPopup(popupContent, {
                    maxWidth: 340,
                    className: 'earthquake-popup',
                    closeButton: true
                });

                marker.bindTooltip(`M ${mag.toFixed(1)} — ${eq.location}`, {
                    className: 'earthquake-tooltip',
                    direction: 'top',
                    offset: [0, -radius]
                });

                marker.on('click', () => {
                    this.onMarkerClick(eq, marker);
                });

                if (mag >= 4.0) {
                    this.addPulseEffect(markerLat, markerLng, color, radius);
                }

                this.markers.addLayer(marker);
            });
        });
    },

    addPulseEffect(lat, lng, color, radius) {
        const pulseMarker = L.circleMarker([lat, lng], {
            radius: radius + 10,
            fillColor: 'transparent',
            color: color,
            weight: 2,
            opacity: 0.4,
            fillOpacity: 0,
            className: 'pulse-ring'
        });
        this.markers.addLayer(pulseMarker);
    },

    createPopupContent(eq) {
        const coordStr = Utils.formatCoordinates(eq.lat, eq.lng);
        const timeStr = Utils.formatDate(eq.date);
        const timeAgo = Utils.timeAgo(eq.date);
        const depthCategory = Utils.getDepthCategory(eq.depth);
        const mapsUrl = Utils.getGoogleMapsUrl(eq.lat, eq.lng);
        const color = Utils.getMagnitudeColor(eq.mag);

        return `
            <div class="popup-card">
                <div class="popup-header" style="border-left: 4px solid ${color}">
                    <span class="popup-mag" style="color:${color}">${eq.mag.toFixed(1)}</span>
                    <div class="popup-title">
                        <strong>${eq.location}</strong>
                        <span class="popup-time">${timeAgo}</span>
                    </div>
                </div>
                <div class="popup-details">
                    <div class="popup-row"><span>🕐</span><span>${timeStr}</span></div>
                    <div class="popup-row"><span>📏</span><span>${eq.depth} km (${depthCategory})</span></div>
                    <div class="popup-row"><span>🌐</span><span>${coordStr}</span></div>
                    <div class="popup-row"><span>🏢</span><span>${eq.sources ? eq.sources.join(', ') : eq.source}</span></div>
                </div>
                <div class="popup-actions">
                    <a href="${mapsUrl}" target="_blank" class="popup-btn">🗺️ Haritada Aç</a>
                </div>
            </div>
        `;
    },

    onMarkerClick(eq, marker) {
        if (typeof App !== 'undefined' && App.showDetail) {
            App.showDetail(eq);
        }

        if (this.selectedMarker) {
            this.selectedMarker.setStyle({ weight: 2 });
        }
        marker.setStyle({ weight: 4 });
        this.selectedMarker = marker;
    },

    focusEarthquake(eq) {
        this.map.flyTo([eq.lat, eq.lng], 10, {
            duration: 1.2,
            easeLinearity: 0.25
        });
    },

    fitAllMarkers() {
        if (this.markers.getLayers().length > 0) {
            const group = new L.featureGroup(this.markers.getLayers());
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    },

    invalidateSize() {
        if (this.map) {
            this.map.invalidateSize();
        }
    }
};
