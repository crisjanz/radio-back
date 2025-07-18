"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeHtmlEntities = decodeHtmlEntities;
exports.parseTrackTitle = parseTrackTitle;
exports.normalizeSongTitle = normalizeSongTitle;
function decodeHtmlEntities(text) {
    if (!text)
        return text;
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&lsquo;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&hellip;/g, '...')
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
        .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
function parseTrackTitle(trackTitle) {
    if (!trackTitle || trackTitle.trim() === '') {
        return {};
    }
    const decodedTitle = decodeHtmlEntities(trackTitle.trim());
    const cleanTitle = decodedTitle;
    const separators = [' - ', ' – ', ' — ', ' | '];
    for (const separator of separators) {
        if (cleanTitle.includes(separator)) {
            const [artist, title] = cleanTitle.split(separator, 2);
            return {
                artist: artist.trim(),
                title: title.trim()
            };
        }
    }
    return { title: cleanTitle };
}
function normalizeSongTitle(title) {
    return decodeHtmlEntities(title)
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^\s*-\s*|\s*-\s*$/g, '')
        .substring(0, 200);
}
