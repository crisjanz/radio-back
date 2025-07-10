"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseImagePath = exports.getImageFileName = exports.getSupabaseImageUrl = exports.STORAGE_BUCKET = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const SUPABASE_URL = 'https://cjtfiazsvflqyyuzgbdb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdGZpYXpzdmZscXl5dXpnYmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NTk1NTAsImV4cCI6MjA2NzQzNTU1MH0.V7HFzf2SszA3wuwPmDDV6-XS9bTtkjNfeayVc2gp6nc';
exports.supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
exports.STORAGE_BUCKET = 'streemr';
const getSupabaseImageUrl = (fileName, options) => {
    const baseUrl = `${SUPABASE_URL}/storage/v1/object/public/${exports.STORAGE_BUCKET}/station-images/${fileName}`;
    if (options) {
        const params = new URLSearchParams();
        if (options.width)
            params.append('width', options.width.toString());
        if (options.height)
            params.append('height', options.height.toString());
        if (options.quality)
            params.append('quality', options.quality.toString());
        const queryString = params.toString();
        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }
    return baseUrl;
};
exports.getSupabaseImageUrl = getSupabaseImageUrl;
const getImageFileName = (stationId, extension = 'png') => {
    return `${stationId}.${extension}`;
};
exports.getImageFileName = getImageFileName;
const getSupabaseImagePath = (stationId, extension = 'png') => {
    return `station-images/${(0, exports.getImageFileName)(stationId, extension)}`;
};
exports.getSupabaseImagePath = getSupabaseImagePath;
