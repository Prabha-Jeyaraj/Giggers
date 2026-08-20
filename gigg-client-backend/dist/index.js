"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const tracking_routes_1 = __importDefault(require("./routes/tracking.routes"));
const maps_routes_1 = __importDefault(require("./routes/maps.routes"));
const kyc_routes_1 = __importDefault(require("./routes/kyc.routes"));
const pipeline_routes_1 = __importDefault(require("./routes/pipeline.routes"));
const clients_routes_1 = __importDefault(require("./routes/clients.routes"));
const recordings_routes_1 = __importDefault(require("./routes/recordings.routes"));
const push_routes_1 = __importDefault(require("./routes/push.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 4000;
app.use((0, helmet_1.default)());
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:6173').split(',');
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, postman) or any localhost/local IP origin
        if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('10.30.')) {
            callback(null, true);
        }
        else {
            callback(null, true); // Fallback: allow for dev flexibility
        }
    },
    credentials: true,
}));
app.use('/api/payments/webhook', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json({ limit: '15mb' }));
// Prevent browser/proxy caching of all dynamic API responses
app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});
app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
}));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/payments', payment_routes_1.default);
app.use('/api/tracking', tracking_routes_1.default);
app.use('/api/maps', maps_routes_1.default);
app.use('/api/kyc', kyc_routes_1.default);
app.use('/api/pipeline', pipeline_routes_1.default);
app.use('/api/clients', clients_routes_1.default);
app.use('/api/recordings', recordings_routes_1.default);
app.use('/api/notifications', push_routes_1.default);
app.use('/api/chat', chat_routes_1.default);
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.use((err, _req, res, _next) => {
    console.error('[Error]', err.message);
    res.status(500).json({ error: err.message || 'Internal server error' });
});
app.listen(PORT, () => {
    console.log(`gigg-client-backend running on http://localhost:${PORT}`);
    console.log(`  Auth:     POST /api/auth/send-otp, POST /api/auth/verify-otp`);
    console.log(`  KYC:      POST /api/kyc/submit`);
    console.log(`  Payments: POST /api/payments/order, POST /api/payments/verify`);
    console.log(`  Tracking: POST /api/tracking/update, GET /api/tracking/job/:id`);
    console.log(`  Maps:     GET  /api/maps/autocomplete, GET /api/maps/place`);
});
exports.default = app;
//# sourceMappingURL=index.js.map