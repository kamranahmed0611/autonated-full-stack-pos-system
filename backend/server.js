require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Validate required environment variables early
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET not set. Set JWT_SECRET in environment (production). Exiting.');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const transactionRoutes = require('./routes/transactions');
const reportRoutes = require('./routes/reports');
const shiftsRoutes = require('./routes/shifts');
const supplierRoutes = require('./routes/suppliers');
const { catRouter, custRouter, userRouter, settingsRouter } = require('./routes/misc');

const app = express();

app.use(helmet());

// Allow configuring frontend origins via FRONTEND_ORIGINS (comma-separated)
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({ origin: FRONTEND_ORIGINS }));

// Increase JSON limit for larger payloads and protect with a global rate limiter
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Keep stricter limits on auth endpoints
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }), authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/categories', catRouter);
app.use('/api/customers', custRouter);
app.use('/api/users', userRouter);
app.use('/api/settings', settingsRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Centralized error handling (don't leak stack in production)
app.use((err, req, res, next) => {
  console.error(err && err.stack ? err.stack : err);
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(500).json({ error: err.message || 'Internal server error', stack: err.stack });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n[SERVER] SuperMart POS Backend running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Database: ${process.env.DB_PATH || './db/supermart.db'}`);
});
