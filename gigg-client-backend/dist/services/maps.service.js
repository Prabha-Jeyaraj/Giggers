"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseGeocode = reverseGeocode;
exports.getDistanceMatrix = getDistanceMatrix;
exports.placesAutocomplete = placesAutocomplete;
exports.getPlaceDetails = getPlaceDetails;
const axios_1 = __importDefault(require("axios"));
const GMAPS_BASE = 'https://maps.googleapis.com/maps/api';
const API_KEY = () => process.env.GOOGLE_MAPS_API_KEY;
// Reverse geocode lat/lng → address components
async function reverseGeocode(lat, lng) {
    // Direct Anna University campus detection
    if (lat >= 13.004 && lat <= 13.020 && lng >= 80.230 && lng <= 80.246) {
        return {
            formattedAddress: 'Anna University Campus, Sardar Patel Road, Guindy, Chennai',
            lat,
            lng,
            city: 'Chennai',
            area: 'Guindy',
        };
    }
    const { data } = await axios_1.default.get(`${GMAPS_BASE}/geocode/json`, {
        params: { latlng: `${lat},${lng}`, key: API_KEY() },
    });
    if (data.status !== 'OK' || !data.results.length) {
        throw new Error(`Geocoding failed: ${data.status}`);
    }
    const result = data.results[0];
    const components = {};
    for (const c of result.address_components) {
        for (const type of c.types) {
            components[type] = c.long_name;
        }
    }
    let formatted = result.formatted_address || '';
    if (/alagappa\s*college|anna\s*univ|ceg|atumx/i.test(formatted)) {
        formatted = 'Anna University Campus, Sardar Patel Road, Guindy, Chennai';
    }
    return {
        formattedAddress: formatted,
        lat,
        lng,
        city: components['locality'] || components['administrative_area_level_2'] || 'Chennai',
        area: components['sublocality_level_1'] || components['sublocality'] || components['neighborhood'] || 'Guindy',
    };
}
// Calculate distance (metres) and duration between two points
async function getDistanceMatrix(origin, destination) {
    const { data } = await axios_1.default.get(`${GMAPS_BASE}/distancematrix/json`, {
        params: {
            origins: `${origin.lat},${origin.lng}`,
            destinations: `${destination.lat},${destination.lng}`,
            mode: 'driving',
            key: API_KEY(),
        },
    });
    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
        throw new Error('Distance Matrix API error');
    }
    return {
        distanceMetres: element.distance.value,
        durationSeconds: element.duration.value,
        distanceText: element.distance.text,
        durationText: element.duration.text,
    };
}
// Autocomplete for place search (used in location picker)
async function placesAutocomplete(input, sessionToken) {
    const { data } = await axios_1.default.get(`${GMAPS_BASE}/place/autocomplete/json`, {
        params: {
            input,
            components: 'country:in',
            key: API_KEY(),
            ...(sessionToken ? { sessiontoken: sessionToken } : {}),
        },
    });
    return (data.predictions || []).map((p) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text || '',
        secondaryText: p.structured_formatting?.secondary_text || '',
    }));
}
// Get lat/lng from a place_id
async function getPlaceDetails(placeId) {
    const { data } = await axios_1.default.get(`${GMAPS_BASE}/place/details/json`, {
        params: { place_id: placeId, fields: 'geometry,formatted_address', key: API_KEY() },
    });
    const location = data.result?.geometry?.location;
    if (!location)
        throw new Error('Place details not found');
    return {
        lat: location.lat,
        lng: location.lng,
        address: data.result.formatted_address,
    };
}
//# sourceMappingURL=maps.service.js.map