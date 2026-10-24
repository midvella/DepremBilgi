

function toDMS(decimal, isLatitude) {
    if (decimal === null || decimal === undefined || isNaN(decimal)) {
        return '—';
    }

    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const secondsNum = (minutesNotTruncated - minutes) * 60;
    const seconds = secondsNum.toFixed(1);

    const padMin = String(minutes).padStart(2, '0');
    const padSec = secondsNum < 10 ? '0' + seconds : seconds;

    let direction = '';
    if (isLatitude) {
        direction = decimal >= 0 ? 'K' : 'G'; 
    } else {
        direction = decimal >= 0 ? 'D' : 'B'; 
    }

    return `${degrees}° ${padMin}' ${padSec}" ${direction}`;
}

function formatCoordinatesDMS(lat, lng) {
    return `${toDMS(lat, true)}, ${toDMS(lng, false)}`;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

function getGoogleMapsUrl(lat, lng) {
    return `https://www.google.com/maps?q=${lat},${lng}&z=10`;
}

function getOsmUrl(lat, lng) {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=10/${lat}/${lng}`;
}

module.exports = {
    toDMS,
    formatCoordinatesDMS,
    calculateDistance,
    getGoogleMapsUrl,
    getOsmUrl
};
