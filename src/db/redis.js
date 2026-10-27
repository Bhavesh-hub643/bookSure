'use strict';
const Redis = require('ioredis');
require('dotenv').config();

const redisClient = new Redis({
  host:             process.env.REDIS_HOST  || '127.0.0.1',
  port:             parseInt(process.env.REDIS_PORT || '6379'),
  password:         process.env.REDIS_PASSWORD || undefined,
  db:               parseInt(process.env.REDIS_DB   || '0'),
  lazyConnect:      true,
  enableReadyCheck: true,
  maxRetriesPerRequest: 1,       // fail fast on individual commands
  retryStrategy: (times) => {
    if (times >= 3) return null; // stop retrying after 3 attempts
    return Math.min(times * 300, 1000);
  },
  reconnectOnError: () => false,  // don't auto-reconnect on command errors
});

redisClient.on('connect',      () => console.log('✅ Redis connected'));
redisClient.on('ready',        () => console.log('✅ Redis ready'));
redisClient.on('error',        (err) => {
  // Suppress repeated ECONNREFUSED noise — just log once
  if (!redisClient._suppressedError) {
    console.warn('⚠️  Redis error:', err.message);
    redisClient._suppressedError = true;
  }
});
redisClient.on('close',        () => { redisClient._suppressedError = false; });
redisClient.on('reconnecting', () => console.warn('⚠️  Redis reconnecting...'));

module.exports = redisClient;
