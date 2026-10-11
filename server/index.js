const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Verify required env vars
const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    console.error('   Copy server/.env.example to server/.env and fill in values');
    process.exit(1);
  }
}

const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1); // Trust first proxy for rate limiting

// ── Security Headers ─────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── Middleware ───────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost',
  'capacitor://localhost',
  'https://tauri.localhost',
  'tauri://localhost'
];

if (process.env.ALLOWED_ORIGINS) {
  const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  allowedOrigins.push(...envOrigins);
} else if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy violation'), false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const { authenticate } = require('./middleware/auth');
const db = require('./config/db');
const { useLocal, getPrivateSignedUrl } = require('./utils/uploadHelper');

// Serve uploaded files statically if local
if (useLocal) {
  const fs = require('fs');
  ['uploads/logos', 'uploads/menu-images', 'private-uploads/payment-proofs', 'private-uploads/licenses'].forEach(dir => {
    fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
  });
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Private uploads (business licenses, payment proofs)
const servePrivateLocal = useLocal ? express.static(path.join(__dirname, 'private-uploads')) : null;

app.use('/api/private-uploads', authenticate, async (req, res, next) => {
  let authorized = false;
  if (req.user.role === 'platform_admin') authorized = true;
  
  if (!authorized && req.user.role === 'restaurant_owner') {
    const urlPath = `/api/private-uploads${req.path}`;
    try {
      if (req.path.startsWith('/licenses/')) {
        const { rows } = await db.query('SELECT id FROM restaurants WHERE business_license_url = $1', [urlPath]);
        if (rows.length > 0 && rows[0].id === req.user.restaurantId) authorized = true;
      } else if (req.path.startsWith('/payment-proofs/')) {
        const { rows } = await db.query('SELECT restaurant_id FROM payment_proofs WHERE screenshot_url = $1', [urlPath]);
        if (rows.length > 0 && rows[0].restaurant_id === req.user.restaurantId) authorized = true;
      }
    } catch (err) {
      console.error('Private upload auth error:', err);
    }
  }
  
  if (!authorized) {
    return res.status(403).json({ error: 'Forbidden: unauthorized access to private file' });
  }

  if (useLocal) {
    return next();
  } else {
    try {
      const filePath = req.path.replace(/^\//, '');
      const signedUrl = await getPrivateSignedUrl(filePath);
      return res.redirect(signedUrl);
    } catch (err) {
      console.error('Failed to generate signed URL:', err);
      return res.status(500).json({ error: 'Failed to access file' });
    }
  }
}, ...(useLocal ? [servePrivateLocal] : []));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/cash-drawer', require('./routes/cash_drawer'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/kitchen', require('./routes/kitchen'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/api-keys', require('./routes/api_keys'));
app.use('/api/webhook-endpoints', require('./routes/webhooks_mgmt'));
app.use('/api/loyalty', require('./routes/loyalty'));
app.use('/api/customers', require('./routes/customers').router);
app.use('/api/payments', require('./routes/payments'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/public', require('./routes/public'));
app.use('/api/v1', require('./routes/api_v1'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
    await Promise.race([db.query('SELECT 1'), timeout]);
    res.status(200).json({ status: 'ok', db: 'ok', time: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

// ── 404 catch-all ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  // Redact any Authorization or API keys from error messages before logging
  const safeMessage = (err.stack || err.message || '')
    .replace(/kpos_live_[a-zA-Z0-9_-]+/g, 'kpos_live_[REDACTED]')
    .replace(/whsec_[a-zA-Z0-9_-]+/g, 'whsec_[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]');
  console.error('Unhandled error:', safeMessage);

  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  } else {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Boot Validation ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET must be at least 32 characters long in production.');
    process.exit(1);
  }
  if (!process.env.ALLOWED_ORIGINS) {
    console.error('FATAL: ALLOWED_ORIGINS is required in production.');
    process.exit(1);
  }
  if (!process.env.FRONTEND_URL) {
    console.error('FATAL: FRONTEND_URL is required in production.');
    process.exit(1);
  }
}

// ── Start ─────────────────────────────────────────────────────
let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`\n🚀 kushinaPOS API running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
    console.log(`   API v1 Docs: http://localhost:${PORT}/api/v1/docs`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
    
    // Start background job to expire stale pending payments (>15 min)
    const { startPaymentExpiryJob } = require('./jobs/paymentExpiryJob');
    startPaymentExpiryJob(5 * 60 * 1000);

    // Start background worker for webhook retries (every 60s)
    const { processWebhookRetries } = require('./jobs/webhookDispatcher');
    setInterval(() => {
      processWebhookRetries().catch(() => {});
    }, 60 * 1000);
  });

  // ── Graceful Shutdown ─────────────────────────────────────────
  function shutdown() {
    console.log('SIGTERM/SIGINT received. Shutting down gracefully...');
    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await db.end(); // close pg pool
        console.log('Database pool closed.');
        process.exit(0);
      } catch (err) {
        console.error('Error closing database pool:', err);
        process.exit(1);
      }
    });
    
    // Force close after 10s
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
