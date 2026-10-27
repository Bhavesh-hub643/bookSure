'use strict';
/**
 * Stage 2: Redis Seat Counter Service
 *
 * Manages real-time available seat counts for events using Redis.
 *
 * Key format:  event:seats:<event_id>
 * Value:       integer (remaining available seats)
 *
 * Why Redis?
 *  - DECRBY is atomic — no race condition possible even under thousands of concurrent requests
 *  - Sub-millisecond latency vs hitting PostgreSQL for every seat check
 *
 * Stage 3 builds on this by wrapping DECRBY in a Lua script so
 * we get an atomic check-and-decrement (won't go below zero).
 */
const redis = require('../db/redis');

const SEAT_KEY = (eventId) => `event:seats:${eventId}`;
const SEAT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const SeatCounterService = {
  /**
   * Initialise or overwrite the seat counter for an event.
   * Called when an event is created or when the counter is cold (cache miss).
   */
  async init(eventId, availableSeats) {
    const key = SEAT_KEY(eventId);
    await redis.set(key, availableSeats, 'EX', SEAT_TTL_SECONDS);
    console.log(`[SeatCounter] Initialized: ${key} = ${availableSeats}`);
    return availableSeats;
  },

  /**
   * Get current available seats from Redis.
   * Returns null if key not found (caller should warm from DB).
   */
  async getAvailable(eventId) {
    const val = await redis.get(SEAT_KEY(eventId));
    return val === null ? null : parseInt(val, 10);
  },

  /**
   * Atomically decrement seat count by `count`.
   * Returns the new value AFTER decrement.
   * Does NOT check for negative — use atomicDecrementSafe for safe version.
   */
  async decrement(eventId, count = 1) {
    return redis.decrby(SEAT_KEY(eventId), count);
  },

  /**
   * Atomically increment seat count (used when a booking is cancelled).
   */
  async increment(eventId, count = 1) {
    return redis.incrby(SEAT_KEY(eventId), count);
  },

  /**
   * Delete the seat counter key (forces a cold-start recalc next time).
   */
  async reset(eventId) {
    return redis.del(SEAT_KEY(eventId));
  },

  /**
   * Stage 3: Lua-scripted atomic check-and-decrement.
   *
   * Atomically:
   *   1. Read current seat count
   *   2. If count >= requested tickets → decrement and return new count
   *   3. If count < requested tickets → return -1 (no seats available)
   *
   * This is a single round-trip to Redis; no race window exists between
   * the read and the write (the Lua script executes atomically in Redis).
   */
  async atomicDecrementSafe(eventId, ticketsRequested) {
    const luaScript = `
      local key     = KEYS[1]
      local needed  = tonumber(ARGV[1])
      local current = tonumber(redis.call('GET', key))

      if current == nil then
        return -2
      end

      if current < needed then
        return -1
      end

      return redis.call('DECRBY', key, needed)
    `;

    const result = await redis.eval(luaScript, 1, SEAT_KEY(eventId), ticketsRequested);
    return parseInt(result, 10);
    // -2 → key not in Redis (cold start — caller must warm)
    // -1 → not enough seats
    // >= 0 → new remaining seat count after successful decrement
  },
};

module.exports = SeatCounterService;
