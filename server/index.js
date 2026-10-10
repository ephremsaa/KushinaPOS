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

// Serve uploaded files statically
const fs = require('fs');
['uploads/logos', 'uploads/menu-images', 'private-uploads/payment-proofs', 'private-uploads/licenses'].forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const { authenticate } = require('./middleware/auth');
const db = require('./config/db');

// Private uploads (business licenses, payment proofs)
app.use('/api/private-uploads', authenticate, async (req, res, next) => {
  if (req.user.role === 'platform_admin') return next();
  
  if (req.user.role === 'restaurant_owner') {
    const urlPath = `/api/private-uploads${req.path}`;
    try {
      if (req.path.startsWith('/licenses/')) {
        const { rows } = await db.query('SELECT id FROM restaurants WHERE business_license_url = $1', [urlPath]);
        if (rows.length > 0 && rows[0].id === req.user.restaurantId) return next();
      } else if (req.path.startsWith('/payment-proofs/')) {
        const { rows } = await db.query('SELECT restaurant_id FROM payment_proofs WHERE screenshot_url = $1', [urlPath]);
        if (rows.length > 0 && rows[0].restaurant_id === req.user.restaurantId) return next();
      }
    } catch (err) {
      console.error('Private upload auth error:', err);
    }
  }
  
  return res.status(403).json({ error: 'Forbidden: unauthorized access to private file' });
}, express.static(path.join(__dirname, 'private-uploads')));

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
app.use('/api/public', require('./routes/public'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: '1.0.0' });
});

// ── 404 catch-all ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack || err);
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  } else {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Start ─────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🚀 kushinaPOS API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
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

module.exports = app;
