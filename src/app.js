'use strict';
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const errorHandler = require('./middleware/errorHandler');

// Route Imports
const userRoutes       = require('./routes/user.routes');
const organizerRoutes  = require('./routes/organizer.routes');
const eventRoutes      = require('./routes/event.routes');   // includes /:id/images sub-route
const bookingRoutes    = require('./routes/booking.routes');
const paymentRoutes    = require('./routes/payment.routes');
const categoryRoutes   = require('./routes/category.routes');
const redisRoutes      = require('./routes/redis.routes');    // Stage 2: debug/testing routes
const adminRoutes      = require('./routes/admin.routes');    // Testing Visualizer & DB admin

// Controller for nested route
const { getBookingsByUser } = require('./controllers/booking.controller');
const auth = require('./middleware/auth');

const app = express();

// ─── Global Middleware ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'eventSync API is running 🚀' });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/users',       userRoutes);
app.use('/organizers',  organizerRoutes);
app.use('/events',      eventRoutes);        // includes /:id/images sub-route
app.use('/bookings',    bookingRoutes);
app.use('/payments',    paymentRoutes);
app.use('/categories',  categoryRoutes);
app.use('/redis',       redisRoutes);        // Stage 2: Redis debug/testing
app.use('/admin',       adminRoutes);        // Stage 3: Visualizer and seeder

// Nested route: GET /users/:id/bookings
app.get('/users/:id/bookings', auth, getBookingsByUser);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
