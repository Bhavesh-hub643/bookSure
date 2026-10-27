'use strict';
/**
 * Redis debug/admin routes (for testing only)
 * Prefix: /redis
 *
 * DO NOT expose these in production.
 */
const { Router } = require('express');
const redis            = require('../db/redis');
const SeatCounterService = require('../services/seatCounter.service');
const CacheService     = require('../services/cache.service');
const EventModel       = require('../models/event.model');

const router = Router();

// GET /redis/health  → ping Redis
router.get('/health', async (req, res) => {
  try {
    const pong = await redis.ping();
    const info = await redis.info('server');
    const versionMatch = info.match(/redis_version:(.+)/);
    return res.json({
      success: true,
      ping:    pong,
      version: versionMatch ? versionMatch[1].trim() : 'unknown',
    });
  } catch (err) {
    return res.status(503).json({ success: false, message: err.message });
  }
});

// GET /redis/seats/:eventId  → view seat counter
router.get('/seats/:eventId', async (req, res) => {
  try {
    const val = await SeatCounterService.getAvailable(req.params.eventId);
    return res.json({ success: true, event_id: req.params.eventId, available_seats: val });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /redis/seats/:eventId/warm  → manually warm seat counter from DB
router.post('/seats/:eventId/warm', async (req, res) => {
  try {
    const event = await EventModel.findById(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const booked    = await EventModel.getBookedSeats(req.params.eventId);
    const available = event.capacity - booked;
    await SeatCounterService.init(req.params.eventId, available);

    return res.json({ success: true, event_id: req.params.eventId, available_seats: available });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /redis/cache  → flush entire Redis DB (testing only)
router.delete('/cache', async (req, res) => {
  try {
    await CacheService.flushAll();
    return res.json({ success: true, message: 'Redis DB flushed' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /redis/keys  → list all keys (testing only)
router.get('/keys', async (req, res) => {
  try {
    const keys = await redis.keys('*');
    return res.json({ success: true, count: keys.length, keys });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
