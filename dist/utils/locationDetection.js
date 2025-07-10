"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientIP = getClientIP;
exports.detectLocationFromIP = detectLocationFromIP;
exports.getLocationFromHeaders = getLocationFromHeaders;
exports.detectUserLocation = detectUserLocation;
exports.normalizeCountryName = normalizeCountryName;
exports.getNearbyCountries = getNearbyCountries;
const countryCodeMap = {
    'US': 'United States',
    'CA': 'Canada',
    'GB': 'United Kingdom',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'IT': 'Italy',
    'ES': 'Spain',
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'BR': 'Brazil',
    'MX': 'Mexico',
    'AR': 'Argentina',
    'JP': 'Japan',
    'KR': 'South Korea',
    'CN': 'China',
    'IN': 'India',
    'RU': 'Russia',
    'SE': 'Sweden',
    'NO': 'Norway',
    'DK': 'Denmark',
    'FI': 'Finland',
    'CH': 'Switzerland',
    'AT': 'Austria',
    'IE': 'Ireland',
    'PL': 'Poland',
    'CZ': 'Czech Republic',
    'TR': 'Turkey',
    'GR': 'Greece',
    'PT': 'Portugal',
    'ZA': 'South Africa',
    'EG': 'Egypt',
    'IL': 'Israel',
    'AE': 'United Arab Emirates',
    'SA': 'Saudi Arabia',
    'TH': 'Thailand',
    'SG': 'Singapore',
    'MY': 'Malaysia',
    'ID': 'Indonesia',
    'PH': 'Philippines',
    'VN': 'Vietnam',
    'NZ': 'New Zealand',
    'CL': 'Chile',
    'CO': 'Colombia',
    'PE': 'Peru',
    'VE': 'Venezuela',
    'UY': 'Uruguay',
    'EC': 'Ecuador',
    'BO': 'Bolivia',
    'PY': 'Paraguay',
};
function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    if (realIP) {
        return realIP;
    }
    if (remoteAddress) {
        return remoteAddress.replace(/^::ffff:/, '');
    }
    return 'unknown';
}
async function detectLocationFromIP(ipAddress) {
    if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'unknown') {
        return {
            country: 'United States',
            countryCode: 'US',
            city: 'Development',
            confidence: 0.1
        };
    }
    const services = [
        () => detectWithIpAPI(ipAddress),
        () => detectWithIpinfo(ipAddress),
        () => detectWithCloudflare(ipAddress)
    ];
    for (const service of services) {
        try {
            const result = await service();
            if (result.confidence > 0.5) {
                return result;
            }
        }
        catch (error) {
            console.warn(`IP geolocation service failed for ${ipAddress}:`, error);
            continue;
        }
    }
    return {
        country: 'United States',
        countryCode: 'US',
        confidence: 0.1
    };
}
async function detectWithIpAPI(ipAddress) {
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
    if (!response.ok) {
        throw new Error(`IP API failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.error) {
        throw new Error(`IP API error: ${data.reason}`);
    }
    return {
        country: data.country_name || countryCodeMap[data.country_code] || data.country_code,
        countryCode: data.country_code,
        region: data.region,
        city: data.city,
        timezone: data.timezone,
        confidence: 0.8
    };
}
async function detectWithIpinfo(ipAddress) {
    const response = await fetch(`https://ipinfo.io/${ipAddress}/json`);
    if (!response.ok) {
        throw new Error(`IPinfo failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.bogon) {
        throw new Error('IP is bogon (private/reserved)');
    }
    return {
        country: countryCodeMap[data.country] || data.country,
        countryCode: data.country,
        region: data.region,
        city: data.city,
        timezone: data.timezone,
        confidence: 0.75
    };
}
async function detectWithCloudflare(ipAddress) {
    const response = await fetch(`https://www.cloudflare.com/cdn-cgi/trace`);
    if (!response.ok) {
        throw new Error(`Cloudflare trace failed: ${response.status}`);
    }
    const text = await response.text();
    const data = {};
    text.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            data[key] = value;
        }
    });
    const countryCode = data.loc;
    if (!countryCode) {
        throw new Error('No location data from Cloudflare');
    }
    return {
        country: countryCodeMap[countryCode] || countryCode,
        countryCode: countryCode,
        confidence: 0.6
    };
}
function getLocationFromHeaders(req) {
    const cfCountry = req.headers['cf-ipcountry'];
    const cfRegion = req.headers['cf-region'];
    const cfCity = req.headers['cf-city'];
    if (cfCountry && cfCountry !== 'XX') {
        return {
            country: countryCodeMap[cfCountry] || cfCountry,
            countryCode: cfCountry,
            region: cfRegion,
            city: cfCity,
            confidence: 0.9
        };
    }
    return {};
}
async function detectUserLocation(req) {
    const headerLocation = getLocationFromHeaders(req);
    if (headerLocation.country && headerLocation.confidence && headerLocation.confidence > 0.8) {
        return headerLocation;
    }
    const ipAddress = getClientIP(req);
    const ipLocation = await detectLocationFromIP(ipAddress);
    return {
        ...ipLocation,
        ...headerLocation,
        confidence: Math.max(ipLocation.confidence, headerLocation.confidence || 0)
    };
}
function normalizeCountryName(countryName) {
    const normalized = countryName.toLowerCase().trim();
    const countryVariations = {
        'united states': ['usa', 'us', 'united states', 'united states of america', 'the united states', 'america', 'u.s.', 'u.s.a.', 'us of america'],
        'united kingdom': ['uk', 'britain', 'great britain', 'england', 'united kingdom', 'u.k.', 'u.k'],
        'canada': ['canada', 'ca'],
        'germany': ['germany', 'deutschland', 'de'],
        'france': ['france', 'fr'],
        'australia': ['australia', 'au'],
        'brazil': ['brazil', 'brasil', 'br'],
        'russia': ['russia', 'russian federation', 'ru'],
        'china': ['china', 'peoples republic of china', 'prc', 'cn'],
        'japan': ['japan', 'jp'],
        'india': ['india', 'in'],
        'mexico': ['mexico', 'mx'],
        'spain': ['spain', 'es'],
        'italy': ['italy', 'it'],
        'netherlands': ['netherlands', 'holland', 'nl'],
        'south africa': ['south africa', 'za'],
        'argentina': ['argentina', 'ar'],
        'colombia': ['colombia', 'co'],
        'chile': ['chile', 'cl'],
        'peru': ['peru', 'pe'],
        'venezuela': ['venezuela', 've'],
        'switzerland': ['switzerland', 'ch'],
        'austria': ['austria', 'at'],
        'belgium': ['belgium', 'be'],
        'sweden': ['sweden', 'se'],
        'norway': ['norway', 'no'],
        'denmark': ['denmark', 'dk'],
        'finland': ['finland', 'fi'],
        'poland': ['poland', 'pl'],
        'czech republic': ['czech republic', 'czechia', 'cz'],
        'turkey': ['turkey', 'tr'],
        'greece': ['greece', 'gr'],
        'portugal': ['portugal', 'pt'],
        'ireland': ['ireland', 'ie'],
        'south korea': ['south korea', 'korea south', 'republic of korea', 'kr'],
        'israel': ['israel', 'il'],
        'saudi arabia': ['saudi arabia', 'sa'],
        'united arab emirates': ['united arab emirates', 'uae', 'ae'],
        'egypt': ['egypt', 'eg'],
        'thailand': ['thailand', 'th'],
        'singapore': ['singapore', 'sg'],
        'malaysia': ['malaysia', 'my'],
        'indonesia': ['indonesia', 'id'],
        'philippines': ['philippines', 'ph'],
        'vietnam': ['vietnam', 'vn'],
        'new zealand': ['new zealand', 'nz'],
        'uruguay': ['uruguay', 'uy'],
        'bolivia': ['bolivia', 'bo'],
        'paraguay': ['paraguay', 'py'],
        'ecuador': ['ecuador', 'ec']
    };
    for (const [canonical, variations] of Object.entries(countryVariations)) {
        if (variations.includes(normalized)) {
            return variations;
        }
    }
    return [normalized];
}
function getNearbyCountries(countryCode) {
    const regionMap = {
        'US': ['CA', 'MX'],
        'CA': ['US'],
        'MX': ['US'],
        'GB': ['IE', 'FR', 'NL', 'BE'],
        'FR': ['GB', 'DE', 'ES', 'IT', 'BE', 'CH'],
        'DE': ['FR', 'NL', 'BE', 'AT', 'CH', 'PL', 'CZ'],
        'IT': ['FR', 'CH', 'AT', 'ES'],
        'ES': ['FR', 'PT'],
        'PT': ['ES'],
        'NL': ['GB', 'DE', 'BE'],
        'BE': ['GB', 'FR', 'DE', 'NL'],
        'CH': ['FR', 'DE', 'IT', 'AT'],
        'AT': ['DE', 'CH', 'IT', 'CZ'],
        'IE': ['GB'],
        'SE': ['NO', 'DK', 'FI'],
        'NO': ['SE', 'DK', 'FI'],
        'DK': ['SE', 'NO', 'DE'],
        'FI': ['SE', 'NO', 'RU'],
        'BR': ['AR', 'CO', 'VE', 'UY', 'PE', 'BO', 'PY'],
        'AR': ['BR', 'CL', 'UY', 'BO', 'PY'],
        'CL': ['AR', 'PE', 'BO'],
        'CO': ['BR', 'VE', 'EC', 'PE'],
        'PE': ['BR', 'CO', 'EC', 'BO', 'CL'],
        'VE': ['BR', 'CO'],
        'UY': ['BR', 'AR'],
        'EC': ['CO', 'PE'],
        'BO': ['BR', 'AR', 'CL', 'PE', 'PY'],
        'PY': ['BR', 'AR', 'BO'],
        'AU': ['NZ'],
        'NZ': ['AU'],
        'JP': ['KR'],
        'KR': ['JP', 'CN'],
        'CN': ['KR', 'IN', 'TH', 'VN', 'MY'],
        'IN': ['CN', 'TH', 'MY', 'SG'],
        'TH': ['CN', 'IN', 'VN', 'MY', 'SG'],
        'VN': ['CN', 'TH', 'MY'],
        'MY': ['CN', 'IN', 'TH', 'VN', 'SG', 'ID'],
        'SG': ['IN', 'TH', 'MY', 'ID'],
        'ID': ['MY', 'SG', 'PH'],
        'PH': ['ID']
    };
    return regionMap[countryCode] || [];
}
