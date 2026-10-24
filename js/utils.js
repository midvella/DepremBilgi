
const Utils = {
    decimalToDMS(decimal, isLat) {
        const absolute = Math.abs(decimal);
        const degrees = Math.floor(absolute);
        const minutesNotTruncated = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesNotTruncated);
        const secondsNum = (minutesNotTruncated - minutes) * 60;
        const seconds = secondsNum.toFixed(1);

        const padMin = String(minutes).padStart(2, '0');
        const padSec = secondsNum < 10 ? '0' + seconds : seconds;

        let direction;
        if (isLat) {
            direction = decimal >= 0 ? 'K' : 'G';
        } else {
            direction = decimal >= 0 ? 'D' : 'B';
        }
        return `${degrees}° ${padMin}' ${padSec}" ${direction}`;
    },

    formatCoordinates(lat, lng) {
        return `${this.decimalToDMS(lat, true)}, ${this.decimalToDMS(lng, false)}`;
    },

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Istanbul'
        };
        return date.toLocaleDateString('tr-TR', options);
    },

    formatTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Istanbul'
        });
    },

    timeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Az önce';
        if (diffMins < 60) return `${diffMins} dk önce`;
        if (diffHours < 24) return `${diffHours} saat önce`;
        return `${diffDays} gün önce`;
    },

    getMagnitudeColor(mag) {
        if (mag >= 7.0) return '#ff0040';
        if (mag >= 6.0) return '#ff2d2d';
        if (mag >= 5.0) return '#ff6b35';
        if (mag >= 4.0) return '#ff9500';
        if (mag >= 3.0) return '#ffc800';
        if (mag >= 2.0) return '#a8e063';
        return '#63e09e';
    },

    getMagnitudeRadius(mag) {
        if (mag >= 7.0) return 28;
        if (mag >= 6.0) return 22;
        if (mag >= 5.0) return 17;
        if (mag >= 4.0) return 13;
        if (mag >= 3.0) return 10;
        if (mag >= 2.0) return 7;
        return 5;
    },

    getMagnitudeLabel(mag) {
        if (mag >= 7.0) return 'Büyük';
        if (mag >= 6.0) return 'Şiddetli';
        if (mag >= 5.0) return 'Orta-Güçlü';
        if (mag >= 4.0) return 'Hafif';
        if (mag >= 3.0) return 'Küçük';
        return 'Mikro';
    },

    getDepthCategory(depth) {
        if (depth <= 0) return 'Yüzeysel';
        if (depth <= 10) return 'Sığ';
        if (depth <= 70) return 'Normal';
        if (depth <= 300) return 'Orta';
        return 'Derin';
    },

    getGoogleMapsUrl(lat, lng) {
        return `https://www.google.com/maps?q=${lat},${lng}&z=8`;
    },

    getPulseClass(mag) {
        if (mag >= 5.0) return 'pulse-strong';
        if (mag >= 4.0) return 'pulse-medium';
        if (mag >= 3.0) return 'pulse-light';
        return '';
    },

    formatNumber(num) {
        return new Intl.NumberFormat('tr-TR').format(num);
    },

    getDepthColor(depth) {
        if (depth <= 5) return '#00e5ff';
        if (depth <= 10) return '#00bcd4';
        if (depth <= 30) return '#0097a7';
        if (depth <= 70) return '#00695c';
        return '#004d40';
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
