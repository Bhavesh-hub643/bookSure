'use strict';
/**
 * Event Controller — Stage 2 & 3
 *
 * Changes from Stage 1:
 *  - GET /events      → cache-aside via CacheService (Redis → PG fallback)
 *  - GET /events/:id  → cache-aside; available_seats sourced from Redis counter
 *  - POST /events     → initialises Redis seat counter on create
 */
const { validationResult } = require('express-validator');
const EventModel = require('../models/event.model');
const SeatCounterService = require('../services/seatCounter.service');
const CacheService = require('../services/cache.service');
const { getEventAvailability } = require('../services/availability.service');

// POST /events
const createEvent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { organizer_id, category_id, title, description, location, date, capacity, price } = req.body;
    const event = await EventModel.create({
      organizer_id, category_id, title, description, location, date,
      capacity, price: price || 0,
    });

    // Stage 2: Prime the seat counter in Redis immediately after creation
    try {
      await SeatCounterService.init(event.event_id, event.capacity);
    } catch (redisErr) {
      // Non-fatal — counter will be warmed on first GET if Redis is unavailable
      console.warn('[Cache] Could not init seat counter:', redisErr.message);
    }

    // Invalidate event list caches so new event appears
    try {
      await CacheService.invalidateEventLists();
    } catch (_) { }

    return res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
};

// GET /events
const getAllEvents = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20'), 100);
    const offset = parseInt(req.query.offset || '0');

    // Stage 2: Try cache first
    try {
      const cached = await CacheService.getEventList(limit, offset);
      if (cached) {
        return res.status(200).json({
          success: true, count: cached.length, data: cached,
          meta: { source: 'cache' },
        });
      }
    } catch (redisErr) {
      console.warn('[Cache] Redis unavailable, falling back to DB:', redisErr.message);
    }

    // Cache miss → hit DB
    const events = await EventModel.findAll({ limit, offset });

    // Store in cache (fire-and-forget, non-fatal)
    CacheService.setEventList(limit, offset, events).catch(() => { });

    return res.status(200).json({
      success: true, count: events.length, data: events,
      meta: { source: 'db' },
    });
  } catch (err) {
    next(err);
  }
};

const getEventById = async (req, res, next) => {
  try {
    const availability = await getEventAvailability(req.params.id);

    if (!availability) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    return res.status(200).json({
      success: true,
      data: { ...availability.event, available_seats: availability.availableSeats },
      meta: { seats_source: availability.seatsSource },
    });
  } catch (err) {
    next(err);
  }
};

const getEventAvailabilityEndpoint = async (req, res, next) => {
  try {
    const availability = await getEventAvailability(req.params.id);

    if (!availability) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        event_id: availability.event.event_id,
        title: availability.event.title,
        capacity: availability.event.capacity,
        available_seats: availability.availableSeats,
      },
      meta: { seats_source: availability.seatsSource },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createEvent, getAllEvents, getEventById, getEventAvailabilityEndpoint };
