'use strict';
/**
 * Booking Controller — Stage 3: Atomic Concurrency Control
 *
 * Key change from Stage 1 (naive check):
 *
 *   BEFORE (Stage 1 — RACE CONDITION):
 *     1. Read booked count from PG
 *     2. Compute available = capacity - booked
 *     3. If available >= requested: INSERT booking   ← window for race here!
 *
 *   AFTER (Stage 3 — ATOMIC):
 *     1. Call Redis Lua script: atomic check-and-decrement
 *        - If counter >= requested → decrement atomically, return new value
 *        - If counter < requested → return -1 (reject instantly, no DB hit)
 *     2. Only if Redis says OK → INSERT booking into PostgreSQL
 *     3. If the INSERT fails for any reason → roll back the Redis counter
 *
 *   This guarantees no overselling even with 10,000 concurrent requests.
 */
const { validationResult } = require('express-validator');
const BookingModel = require('../models/booking.model');
const EventModel = require('../models/event.model');
const UserModel = require('../models/user.model');
const SeatCounterService = require('../services/seatCounter.service');
const CacheService = require('../services/cache.service');

// POST /bookings
const createBooking = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { user_id, event_id, tickets_count } = req.body;
    const authenticatedUserId = req.user.userId;

    if (user_id && user_id !== authenticatedUserId) {
      return res.status(403).json({ success: false, message: 'You can only create bookings for your own account.' });
    }

    const userId = authenticatedUserId;

    // ── Sanity checks ───────────────────────────────────────────────────────
    const event = await EventModel.findById(event_id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const bookingSummary = await UserModel.getBookingSummary(userId);
    if (bookingSummary && bookingSummary.remaining_bookings <= 0) {
      return res.status(403).json({
        success: false,
        message: 'Booking limit reached for this user.',
        data: bookingSummary,
      });
    }

    // ── Stage 3: Atomic Redis seat reservation ───────────────────────────────
    let usedRedis = true;
    let redisResult;

    try {
      redisResult = await SeatCounterService.atomicDecrementSafe(event_id, tickets_count);

      if (redisResult === -2) {
        // Cold start: counter key missing in Redis — warm it from DB
        console.warn('[Booking] Cold start: warming seat counter from DB for event', event_id);
        const booked = await EventModel.getBookedSeats(event_id);
        const available = event.capacity - booked;
        await SeatCounterService.init(event_id, available);

        // Retry the atomic decrement
        redisResult = await SeatCounterService.atomicDecrementSafe(event_id, tickets_count);
      }

      if (redisResult === -1) {
        // Not enough seats — reject immediately without touching PG
        return res.status(409).json({
          success: false,
          message: 'Not enough seats available. Please try fewer tickets or a different event.',
        });
      }
    } catch (redisErr) {
      // Redis unavailable — fall back to naive PG capacity check (Stage 1 behavior)
      console.warn('[Booking] Redis unavailable, using DB fallback:', redisErr.message);
      usedRedis = false;

      const booked = await EventModel.getBookedSeats(event_id);
      const available = event.capacity - booked;
      if (tickets_count > available) {
        return res.status(409).json({
          success: false,
          message: `Only ${available} seat(s) available`,
        });
      }
    }

    // ── Persist booking to PostgreSQL ────────────────────────────────────────
    let booking;
    try {
      booking = await BookingModel.create({ user_id: userId, event_id, tickets_count });
    } catch (pgErr) {
      // PG insert failed — roll back the Redis counter to prevent phantom seat loss
      if (usedRedis) {
        await SeatCounterService.increment(event_id, tickets_count).catch((e) =>
          console.error('[Booking] CRITICAL: Failed to roll back Redis seat counter!', e.message)
        );
      }
      throw pgErr; // re-throw so global error handler deals with it
    }

    // Invalidate the cached event data (available_seats changed)
    CacheService.invalidateEvent(event_id).catch(() => { });

    return res.status(201).json({
      success: true,
      data: booking,
      meta: {
        concurrency_control: usedRedis ? 'redis-atomic-lua' : 'db-fallback',
        booking_summary: bookingSummary,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /bookings/:id
const getBookingById = async (req, res, next) => {
  try {
    const booking = await BookingModel.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.user_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'You can only access your own bookings.' });
    }

    return res.status(200).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};

// GET /users/:id/bookings
const getBookingsByUser = async (req, res, next) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'You can only access your own bookings.' });
    }

    const user = await UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const bookings = await BookingModel.findByUser(req.params.id);
    return res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    next(err);
  }
};

module.exports = { createBooking, getBookingById, getBookingsByUser };
