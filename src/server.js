'use strict';
require('dotenv').config();
const app = require('./app');
const pool = require('./db/pool');
const redisClient = require('./db/redis');

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    // 1. Verify PostgreSQL
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connection verified');

    // 1a. Ensure new columns exist on databases created before this change
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_limit INTEGER NOT NULL DEFAULT 10');
    console.log('✅ User booking limit migration verified');

    // 2. Connect Redis (non-fatal — app works without it via DB fallback)
    try {
      await redisClient.ping();
      console.log('✅ Redis connection verified');
    } catch (redisErr) {
      console.warn('⚠️  Redis unavailable at startup — running in DB-only mode:', redisErr.message);
      console.warn('   Booking will use DB fallback (race conditions possible under high load).');
    }

    // 3. Start HTTP server
    app.listen(PORT, () => {
      console.log(`\n🚀 eventSync API running at http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (err) {
    console.error('❌ Fatal startup error:', err.message);
    process.exit(1);
  }
};

start();
