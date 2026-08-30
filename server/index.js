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

// ── Security Headers ─────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
const fs = require('fs');
['uploads/logos', 'uploads/menu-images', 'uploads/payment-proofs'].forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/staff',       require('./routes/staff'));
app.use('/api/menu',        require('./routes/menu'));
app.use('/api/tables',      require('./routes/tables'));
app.use('/api/orders',      require('./routes/orders'));
app.use('/api/cash-drawer', require('./routes/cash_drawer'));
app.use('/api/inventory',   require('./routes/inventory'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/kitchen',     require('./routes/kitchen'));
app.use('/api/recipes',     require('./routes/recipes'));
app.use('/api/billing',     require('./routes/billing'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/public',      require('./routes/public'));

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
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 kushinaPOS API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
