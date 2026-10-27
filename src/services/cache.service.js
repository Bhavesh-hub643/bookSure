'use strict';
/**
 * Stage 2: Redis Cache Service
 *
 * Caches frequently-read data (events, categories) to reduce PostgreSQL load.
 *
 * Key formats:
 *   event:<event_id>         → single event object (JSON)
 *   events:list:<limit>:<offset> → paginated event list (JSON)
 *   categories:all           → all categories (JSON)
 *
 * Strategy: Cache-aside (read-through)
 *   1. Check Redis on GET
 *   2. On miss → hit PostgreSQL → store result in Redis with TTL
 *   3. On write (create/update) → invalidate affected cache keys
 */
const redis = require('../db/redis');

const TTL = {
  EVENT:      60 * 5,    // 5 minutes
  EVENT_LIST: 60 * 2,    // 2 minutes
  CATEGORIES: 60 * 60,   // 1 hour
};

const KEYS = {
  event:      (id)               => `event:${id}`,
  eventList:  (limit, offset)    => `events:list:${limit}:${offset}`,
  categories:                       'categories:all',
};

const CacheService = {
  // ─── Events ────────────────────────────────────────────────────────────────

  async getEvent(eventId) {
    const raw = await redis.get(KEYS.event(eventId));
    return raw ? JSON.parse(raw) : null;
  },

  async setEvent(event) {
    await redis.setex(KEYS.event(event.event_id), TTL.EVENT, JSON.stringify(event));
  },

  async invalidateEvent(eventId) {
    await redis.del(KEYS.event(eventId));
  },

  // ─── Event List ────────────────────────────────────────────────────────────

  async getEventList(limit, offset) {
    const raw = await redis.get(KEYS.eventList(limit, offset));
    return raw ? JSON.parse(raw) : null;
  },

  async setEventList(limit, offset, events) {
    await redis.setex(KEYS.eventList(limit, offset), TTL.EVENT_LIST, JSON.stringify(events));
  },

  async invalidateEventLists() {
    // Pattern delete for all event list keys
    const keys = await redis.keys('events:list:*');
    if (keys.length > 0) await redis.del(...keys);
  },

  // ─── Categories ────────────────────────────────────────────────────────────

  async getCategories() {
    const raw = await redis.get(KEYS.categories);
    return raw ? JSON.parse(raw) : null;
  },

  async setCategories(categories) {
    await redis.setex(KEYS.categories, TTL.CATEGORIES, JSON.stringify(categories));
  },

  async invalidateCategories() {
    await redis.del(KEYS.categories);
  },

  // ─── Utility ───────────────────────────────────────────────────────────────

  /** Flush ALL cache keys (for testing/debugging only) */
  async flushAll() {
    await redis.flushdb();
  },
};

module.exports = CacheService;
module.exports.KEYS = KEYS;
