"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const sharp_1 = __importDefault(require("sharp"));
const fs_1 = __importDefault(require("fs"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const supabase_1 = require("../config/supabase");
const station_lookup_1 = require("../utils/station-lookup");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const upload = (0, multer_1.default)({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }
});
const uploadImageToSupabase = async (imageBuffer, stationId, extension = 'png') => {
    const fileName = (0, supabase_1.getImageFileName)(stationId, extension);
    const filePath = (0, supabase_1.getSupabaseImagePath)(stationId, extension);
    console.log(`🔄 Uploading to Supabase - Station: ${stationId}, Path: ${filePath}, Size: ${imageBuffer.length} bytes`);
    const { data, error } = await supabase_1.supabase.storage
        .from('streemr')
        .upload(filePath, imageBuffer, {
        contentType: `image/${extension}`,
        upsert: true
    });
    if (error) {
        console.error('❌ Supabase upload error:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
            stationId,
            filePath,
            bufferSize: imageBuffer.length
        });
        throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }
    console.log('✅ Supabase upload successful:', data?.path);
    const publicUrl = (0, supabase_1.getSupabaseImageUrl)(fileName);
    console.log('🔗 Generated public URL:', publicUrl);
    return publicUrl;
};
router.post('/download', async (req, res) => {
    try {
        const { url, size = 512 } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'Image URL is required' });
        }
        console.log(`Downloading image for preview: ${url}`);
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
            timeout: 10000,
        });
        if (!response.ok) {
            return res.status(400).json({ error: `Failed to download image: ${response.statusText}` });
        }
        const buffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(buffer);
        const maxSize = Math.min(parseInt(size), 1024);
        let processableBuffer = imageBuffer;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('image/x-icon') || contentType?.includes('image/vnd.microsoft.icon') ||
            url.toLowerCase().endsWith('.ico')) {
            console.log('🔍 ICO file detected in preview, converting to PNG format first');
            try {
                const icoMetadata = await (0, sharp_1.default)(imageBuffer, { failOn: 'none' }).metadata();
                if (icoMetadata.format === 'ico') {
                    processableBuffer = await (0, sharp_1.default)(imageBuffer, { failOn: 'none' })
                        .png()
                        .toBuffer();
                    console.log('✅ Successfully converted ICO to PNG for preview');
                }
            }
            catch (icoError) {
                console.log('⚠️ ICO conversion failed for preview, will use original buffer');
            }
        }
        const metadata = await (0, sharp_1.default)(processableBuffer).metadata();
        console.log(`Original image: ${metadata.width}x${metadata.height}, requested: ${maxSize}x${maxSize}`);
        const processedImageBuffer = await (0, sharp_1.default)(processableBuffer)
            .png({ quality: 90 })
            .resize(maxSize, maxSize, {
            fit: 'inside',
            withoutEnlargement: false
        })
            .toBuffer();
        const base64Image = `data:image/png;base64,${processedImageBuffer.toString('base64')}`;
        res.json({
            success: true,
            imageData: base64Image,
            originalUrl: url,
            dimensions: {
                width: Math.min(metadata.width || maxSize, maxSize),
                height: Math.min(metadata.height || maxSize, maxSize),
                original: {
                    width: metadata.width,
                    height: metadata.height
                }
            }
        });
    }
    catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download and process image' });
    }
});
router.post('/download/:stationId', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)({ params: { id: req.params.stationId } });
        if (idType === 'invalid') {
            return res.status(400).json({ error: 'Invalid station ID format' });
        }
        const { url: bodyUrl, size = 512 } = req.body;
        const queryUrl = req.query.url;
        const url = queryUrl || bodyUrl;
        const station = await (0, station_lookup_1.findStationByEitherId)(stationIdParam, {
            select: { id: true, name: true, favicon: true, logo: true, local_image_url: true }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        let imageUrl = url;
        if (!imageUrl) {
            if (station.logo) {
                imageUrl = station.logo;
            }
            else if (station.favicon) {
                imageUrl = station.favicon;
            }
        }
        if (!imageUrl) {
            return res.status(400).json({ error: 'No favicon or logo URL found for station' });
        }
        const isForceRedownload = req.query.force === 'true';
        console.log(`${isForceRedownload ? 'Re-downloading' : 'Downloading'} image for station ${station.id}: ${imageUrl}`);
        const response = await (0, node_fetch_1.default)(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
            timeout: 10000,
        });
        if (!response.ok) {
            return res.status(400).json({ error: `Failed to download image: ${response.statusText}` });
        }
        const buffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(buffer);
        const maxSize = Math.min(parseInt(size), 1024);
        let processableBuffer = imageBuffer;
        let isIcoFile = false;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('image/x-icon') || contentType?.includes('image/vnd.microsoft.icon') ||
            imageUrl.toLowerCase().endsWith('.ico')) {
            isIcoFile = true;
            console.log('🔍 ICO file detected, converting to PNG format first');
            try {
                const icoMetadata = await (0, sharp_1.default)(imageBuffer, { failOn: 'none' }).metadata();
                if (icoMetadata.format === 'ico') {
                    processableBuffer = await (0, sharp_1.default)(imageBuffer, { failOn: 'none' })
                        .png()
                        .toBuffer();
                    console.log('✅ Successfully converted ICO to PNG');
                }
            }
            catch (icoError) {
                console.log('⚠️ ICO conversion failed, will use original buffer and hope for the best');
            }
        }
        const metadata = await (0, sharp_1.default)(processableBuffer).metadata();
        console.log(`Original image: ${metadata.width}x${metadata.height}, requested: ${maxSize}x${maxSize}`);
        const shouldResize = (metadata.width && metadata.width > maxSize) ||
            (metadata.height && metadata.height > maxSize) ||
            req.query.resize === 'true';
        let processedImageBuffer;
        if (shouldResize) {
            processedImageBuffer = await (0, sharp_1.default)(processableBuffer)
                .png({ quality: 90 })
                .resize(maxSize, maxSize, {
                fit: 'inside',
                withoutEnlargement: false
            })
                .toBuffer();
        }
        else {
            processedImageBuffer = await (0, sharp_1.default)(processableBuffer)
                .png({ quality: 90 })
                .toBuffer();
        }
        console.log(`📸 About to upload image for station ${station.id}, buffer size: ${processedImageBuffer.length}`);
        const supabaseImageUrl = await uploadImageToSupabase(processedImageBuffer, station.id, 'png');
        console.log(`🎯 Upload completed, URL: ${supabaseImageUrl}`);
        await prisma.station.update({
            where: { id: station.id },
            data: {
                local_image_url: supabaseImageUrl
            }
        });
        const finalMetadata = await (0, sharp_1.default)(processedImageBuffer).metadata();
        res.json({
            success: true,
            imageUrl: supabaseImageUrl,
            originalUrl: imageUrl,
            stationName: station.name,
            dimensions: {
                width: finalMetadata.width,
                height: finalMetadata.height,
                original: {
                    width: metadata.width,
                    height: metadata.height
                }
            }
        });
    }
    catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download and process image' });
    }
});
router.post('/upload/:stationId', upload.single('image'), async (req, res) => {
    try {
        console.log(`📥 Upload request for station ${req.params.stationId}`);
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)({ params: { id: req.params.stationId } });
        if (idType === 'invalid') {
            console.log('❌ Invalid station ID format');
            return res.status(400).json({ error: 'Invalid station ID format' });
        }
        if (!req.file) {
            console.log('❌ No image file provided');
            return res.status(400).json({ error: 'No image file provided' });
        }
        console.log(`📄 File info: ${req.file.filename}, size: ${req.file.size}, path: ${req.file.path}`);
        const station = await (0, station_lookup_1.findStationByEitherId)(stationIdParam, {
            select: { id: true, name: true }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        const originalMetadata = await (0, sharp_1.default)(req.file.path).metadata();
        console.log(`📋 Original uploaded file: ${originalMetadata.width}x${originalMetadata.height}, format: ${originalMetadata.format}, hasAlpha: ${originalMetadata.hasAlpha}`);
        const processedImageBuffer = await (0, sharp_1.default)(req.file.path)
            .png({ quality: 90 })
            .toBuffer();
        const processedMetadata = await (0, sharp_1.default)(processedImageBuffer).metadata();
        console.log(`📋 Processed image: ${processedMetadata.width}x${processedMetadata.height}, format: ${processedMetadata.format}, hasAlpha: ${processedMetadata.hasAlpha}`);
        fs_1.default.unlinkSync(req.file.path);
        console.log(`📤 Uploading processed image to Supabase for station ${station.id}`);
        const supabaseImageUrl = await uploadImageToSupabase(processedImageBuffer, station.id, 'png');
        console.log(`✅ Supabase upload successful: ${supabaseImageUrl}`);
        console.log(`📝 Updating database for station ${station.id}`);
        await prisma.station.update({
            where: { id: station.id },
            data: { local_image_url: supabaseImageUrl }
        });
        console.log(`✅ Database updated successfully`);
        res.json({
            success: true,
            imageUrl: supabaseImageUrl,
            stationName: station.name
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        if (req.file && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to upload and process image' });
    }
});
router.get('/broken', async (req, res) => {
    try {
        const stations = await prisma.station.findMany({
            where: {
                OR: [
                    { favicon: null },
                    { favicon: '' },
                    { favicon: { startsWith: 'http://' } }
                ]
            },
            select: {
                id: true,
                name: true,
                country: true,
                favicon: true,
                logo: true
            },
            orderBy: { name: 'asc' }
        });
        res.json(stations);
    }
    catch (error) {
        console.error('Error fetching broken favicons:', error);
        res.status(500).json({ error: 'Failed to fetch stations with broken favicons' });
    }
});
router.post('/batch-download', async (req, res) => {
    try {
        const { stationIds } = req.body;
        if (!Array.isArray(stationIds) || stationIds.length === 0) {
            return res.status(400).json({ error: 'Invalid or empty station IDs array' });
        }
        const results = [];
        for (const stationId of stationIds) {
            try {
                const station = await prisma.station.findUnique({
                    where: { id: parseInt(stationId) },
                    select: { id: true, name: true, favicon: true, logo: true }
                });
                if (!station) {
                    results.push({ stationId, success: false, error: 'Station not found' });
                    continue;
                }
                const imageUrl = station.favicon || station.logo;
                if (!imageUrl) {
                    results.push({ stationId, success: false, error: 'No favicon or logo URL' });
                    continue;
                }
                const response = await (0, node_fetch_1.default)(imageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    },
                    redirect: 'follow',
                    timeout: 10000,
                });
                if (!response.ok) {
                    results.push({ stationId, success: false, error: `Download failed: ${response.statusText}` });
                    continue;
                }
                const buffer = await response.arrayBuffer();
                const imageBuffer = Buffer.from(buffer);
                const processedImageBuffer = await (0, sharp_1.default)(imageBuffer)
                    .png({ quality: 90 })
                    .resize(256, 256, {
                    fit: 'inside',
                    withoutEnlargement: false
                })
                    .toBuffer();
                const supabaseImageUrl = await uploadImageToSupabase(processedImageBuffer, station.id, 'png');
                await prisma.station.update({
                    where: { id: station.id },
                    data: { local_image_url: supabaseImageUrl }
                });
                results.push({
                    stationId,
                    success: true,
                    imageUrl: supabaseImageUrl,
                    stationName: station.name
                });
            }
            catch (error) {
                console.error(`Error processing station ${stationId}:`, error);
                results.push({ stationId, success: false, error: 'Processing failed' });
            }
        }
        res.json({ results });
    }
    catch (error) {
        console.error('Batch download error:', error);
        res.status(500).json({ error: 'Failed to process batch download' });
    }
});
router.get('/info/:stationId', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)({ params: { id: req.params.stationId } });
        if (idType === 'invalid') {
            return res.status(400).json({ error: 'Invalid station ID format' });
        }
        const station = await (0, station_lookup_1.findStationByEitherId)(stationIdParam, {
            select: { id: true, name: true, favicon: true, logo: true, local_image_url: true }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        let primaryImageUrl = null;
        let hasLocalImage = false;
        if (station.local_image_url) {
            primaryImageUrl = station.local_image_url;
            hasLocalImage = true;
        }
        else if (station.logo) {
            primaryImageUrl = station.logo;
        }
        else if (station.favicon) {
            primaryImageUrl = station.favicon;
        }
        res.json({
            station: {
                id: station.id,
                name: station.name,
                favicon: station.favicon,
                logo: station.logo,
                local_image_url: station.local_image_url
            },
            hasLocalImage,
            localImageUrl: primaryImageUrl,
            imageUrls: {
                local: station.local_image_url,
                logo: station.logo,
                favicon: station.favicon
            }
        });
    }
    catch (error) {
        console.error('Error fetching image info:', error);
        res.status(500).json({ error: 'Failed to fetch image info' });
    }
});
exports.default = router;
