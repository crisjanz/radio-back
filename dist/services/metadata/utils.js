"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTrackTitle = parseTrackTitle;
exports.normalizeSongTitle = normalizeSongTitle;
function parseTrackTitle(trackTitle) {
    if (!trackTitle || trackTitle.trim() === '') {
        return {};
    }
    const cleanTitle = trackTitle.trim();
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
    return title
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/^\s*-\s*|\s*-\s*$/g, '')
        .substring(0, 200);
}
