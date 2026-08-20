import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes';
import paymentRoutes from './routes/payment.routes';
import trackingRoutes from './routes/tracking.routes';
import mapsRoutes from './routes/maps.routes';
import kycRoutes from './routes/kyc.routes';
import pipelineRoutes from './routes/pipeline.routes';
import clientsRoutes from './routes/clients.routes';
import recordingsRoutes from './routes/recordings.routes';
import pushRoutes from './routes/push.routes';
import chatRoutes from './routes/chat.routes';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:6173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, postman) or any localhost/local IP origin
    if (!origin || allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('10.30.')) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback: allow for dev flexibility
    }
  },
  credentials: true,
}));

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '15mb' }));

// Prevent browser/proxy caching of all dynamic API responses
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/maps', mapsRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/notifications', pushRoutes);
app.use('/api/chat', chatRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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

export default app;
