"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const stations_js_1 = __importDefault(require("./routes/stations.js"));
const metadata_js_1 = __importDefault(require("./routes/metadata.js"));
const import_js_1 = __importDefault(require("./routes/import.js"));
const iheart_js_1 = __importDefault(require("./routes/iheart.js"));
const admin_js_1 = __importDefault(require("./routes/admin.js"));
const scraping_js_1 = __importDefault(require("./routes/scraping.js"));
const health_js_1 = __importDefault(require("./routes/health.js"));
const auth_js_1 = __importDefault(require("./routes/auth.js"));
const favorites_js_1 = __importDefault(require("./routes/favorites.js"));
const test_js_1 = __importDefault(require("./routes/test.js"));
const images_js_1 = __importDefault(require("./routes/images.js"));
const image_proxy_js_1 = __importDefault(require("./routes/image-proxy.js"));
const memory_js_1 = __importDefault(require("./routes/memory.js"));
const feedback_js_1 = __importDefault(require("./routes/feedback.js"));
const memoryMonitor_js_1 = require("./middleware/memoryMonitor.js");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(memoryMonitor_js_1.memoryMonitor.middleware());
app.use('/station-images', express_1.default.static('public/station-images'));
app.use('/public', express_1.default.static('public'));
app.use('/js', express_1.default.static('public/js'));
app.use('/components', express_1.default.static('public/components'));
app.use('/stations', stations_js_1.default);
app.use('/metadata', metadata_js_1.default);
app.use('/import', import_js_1.default);
app.use('/iheart', iheart_js_1.default);
app.use('/admin', admin_js_1.default);
app.use('/scrape', scraping_js_1.default);
app.use('/health', health_js_1.default);
app.use('/auth', auth_js_1.default);
app.use('/api/favorites', favorites_js_1.default);
app.use('/api/test', test_js_1.default);
app.use('/images', images_js_1.default);
app.use('/image-proxy', image_proxy_js_1.default);
app.use('/memory', memory_js_1.default);
app.use('/api/feedback', feedback_js_1.default);
app.get('/admin/stations', (req, res) => {
    res.sendFile('admin-stations.html', { root: 'public' });
});
app.get('/admin/stations/edit', (req, res) => {
    res.sendFile('admin-stations-edit.html', { root: 'public' });
});
app.get('/admin/memory', (req, res) => {
    res.sendFile('admin-memory.html', { root: 'public' });
});
app.get('/admin/simple-image-editor', (req, res) => {
    res.sendFile('simple-image-editor.html', { root: 'public' });
});
app.get('/admin/stations/import', (req, res) => {
    res.sendFile('admin-stations-import.html', { root: 'public' });
});
app.get('/admin/iheart-import', (req, res) => {
    res.sendFile('admin-iheart-import.html', { root: 'public' });
});
app.get('/admin/cleanup', (req, res) => {
    res.sendFile('admin-cleanup.html', { root: 'public' });
});
app.get('/admin/logo-manager', (req, res) => {
    res.sendFile('admin-logo-manager.html', { root: 'public' });
});
app.get('/ping', async (req, res) => {
    try {
        const uptime = process.uptime();
        const timestamp = new Date().toISOString();
        res.json({
            ok: true,
            timestamp,
            uptime: Math.round(uptime),
            message: 'Backend is alive'
        });
    }
    catch (err) {
        console.error('Ping failed:', err);
        res.status(500).json({ ok: false, error: 'Ping error' });
    }
});
app.get('/stations/countries', async (req, res) => {
    try {
        const countries = await prisma.station.groupBy({
            by: ['country'],
            _count: true,
            orderBy: {
                _count: {
                    country: 'desc'
                }
            }
        });
        const formattedCountries = countries.map(country => ({
            country: country.country,
            count: country._count
        }));
        res.json(formattedCountries);
    }
    catch (error) {
        console.error('❌ Error fetching countries:', error);
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
});
app.get('/stations/genres', async (req, res) => {
    try {
        const genres = await prisma.station.groupBy({
            by: ['genre'],
            _count: true,
            where: {
                genre: {
                    not: null
                }
            },
            orderBy: {
                _count: {
                    genre: 'desc'
                }
            }
        });
        const formattedGenres = genres.map(genre => ({
            genre: genre.genre,
            count: genre._count
        }));
        res.json(formattedGenres);
    }
    catch (error) {
        console.error('❌ Error fetching genres:', error);
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});
app.get("/", (req, res) => {
    res.send("Radio backend is working!");
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    if (error.code === 'EPIPE') {
        console.log('🔧 EPIPE error caught and handled - continuing server operation');
        return;
    }
    console.error('💥 Critical error - shutting down server');
    process.exit(1);
});
memoryMonitor_js_1.memoryMonitor.registerCleanupCallback(() => {
    console.log('🧹 Emergency cleanup: Clearing metadata request cache');
    try {
        require('./services/metadata/extractors/icecast.js').clearActiveRequests?.();
    }
    catch (error) {
        console.log('⚠️ Could not clear metadata cache:', error);
    }
});
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`✅ Server is running on http://${HOST}:${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
        console.log("📱 Mobile access: http://192.168.1.69:3001");
    }
    console.log("🔗 Available routes:");
    console.log("   • /stations - Station CRUD operations");
    console.log("   • /metadata - Icecast metadata detection");
    console.log("   • /import - Radio Browser import endpoints");
    console.log("   • /iheart - iHeart Radio import endpoints");
    console.log("   • /admin - Admin dashboard and management");
    console.log("   • /health - Stream health checking endpoints");
    console.log("   • /auth - Authentication endpoints");
    console.log("   • /api/favorites - User favorites endpoints");
    console.log("   • /api/feedback - Station feedback and rating system");
    console.log("   • /images - Image management and processing endpoints");
    console.log("   • /memory - Memory monitoring endpoints");
    console.log("   • /station-images - Static image serving");
});
