#!/usr/bin/env node
/**
 * eventSync — Concurrency Stress Test (Stage 3)
 * ------------------------------------------------
 * Simulates N concurrent booking requests for an event with M seats.
 * Proves that the Redis atomic Lua script prevents overselling.
 *
 * Usage:
 *   node tests/concurrency.test.js [eventId] [userId] [concurrent] [ticketsEach]
 *
 * Example:
 *   node tests/concurrency.test.js <event_id> <user_id> 50 1
 *   → 50 simultaneous requests each trying to book 1 ticket
 */
'use strict';
require('dotenv').config();
const http = require('http');

const BASE_URL   = `http://localhost:${process.env.PORT || 3000}`;
const EVENT_ID   = process.argv[2];
const USER_ID    = process.argv[3];
const CONCURRENT = parseInt(process.argv[4] || '20');
const TICKETS    = parseInt(process.argv[5] || '1');
let   JWT_TOKEN  = process.argv[6] || '';

if (!EVENT_ID || !USER_ID) {
  console.error('Usage: node tests/concurrency.test.js <event_id> <user_id> [concurrent=20] [tickets=1] [jwt_token]');
  process.exit(1);
}

function postJSON(path, body, token) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const url     = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port:     url.port,
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.write(payload);
    req.end();
  });
}

function getJSON(path) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    http.get({ hostname: url.hostname, port: url.port, path: url.pathname }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on('error', (err) => resolve({ status: 0, error: err.message }));
  });
}

async function run() {
  console.log('\n====================================================');
  console.log('  eventSync Concurrency Test — Stage 3');
  console.log('====================================================');
  console.log(`  API Base:     ${BASE_URL}`);
  console.log(`  Event ID:     ${EVENT_ID}`);
  console.log(`  User ID:      ${USER_ID}`);
  console.log(`  Concurrent:   ${CONCURRENT} simultaneous requests`);
  console.log(`  Tickets/req:  ${TICKETS}`);
  console.log('====================================================\n');

  // 1. Check event details before test
  const eventBefore = await getJSON(`/events/${EVENT_ID}`);
  if (!eventBefore.body.success) {
    console.error('❌ Event not found. Check the event_id.');
    process.exit(1);
  }
  const capacity  = eventBefore.body.data.capacity;
  const available = eventBefore.body.data.available_seats;
  console.log(`📋 Event:      "${eventBefore.body.data.title}"`);
  console.log(`   Capacity:   ${capacity}`);
  console.log(`   Available:  ${available} (from ${eventBefore.body.meta?.seats_source})\n`);

  // 2. Check Redis seat counter directly
  const redisBefore = await getJSON(`/redis/seats/${EVENT_ID}`);
  console.log(`🔴 Redis counter before: ${redisBefore.body.available_seats}\n`);

  // 3. Fire concurrent requests
  console.log(`🔥 Firing ${CONCURRENT} concurrent booking requests...`);
  const start    = Date.now();
  const promises = Array.from({ length: CONCURRENT }, (_, i) =>
    postJSON('/bookings', {
      user_id:       USER_ID,
      event_id:      EVENT_ID,
      tickets_count: TICKETS,
    }, JWT_TOKEN)
  );

  const results  = await Promise.all(promises);
  const elapsed  = Date.now() - start;

  // 4. Tally results
  const succeeded = results.filter((r) => r.status === 201);
  const rejected  = results.filter((r) => r.status === 409);
  const errors    = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log(`\n⏱️  Completed in ${elapsed}ms\n`);
  console.log('📊 Results:');
  console.log(`   ✅ Succeeded (201):   ${succeeded.length}`);
  console.log(`   🚫 Rejected  (409):   ${rejected.length}`);
  console.log(`   ❌ Errors    (other): ${errors.length}`);
  if (errors.length > 0) {
    console.log('   Error details:', errors.slice(0, 3));
  }

  // 5. Check totals match expected
  const expectedSuccesses = Math.min(CONCURRENT, Math.floor(available / TICKETS));
  const ticketsBooked     = succeeded.length * TICKETS;

  console.log('\n🔍 Verification:');
  console.log(`   Tickets booked in this run: ${ticketsBooked}`);
  console.log(`   Expected max successes:     ${expectedSuccesses}`);

  if (ticketsBooked > available) {
    console.log('\n❌ OVERSELL DETECTED! Race condition was NOT prevented.');
    console.log('   This should not happen if Redis is working correctly.');
  } else {
    console.log('\n✅ No oversell detected. Atomic concurrency control working correctly.');
  }

  // 6. Check Redis counter after
  const redisAfter = await getJSON(`/redis/seats/${EVENT_ID}`);
  console.log(`\n🔴 Redis counter after:  ${redisAfter.body.available_seats}`);
  console.log(`   Expected counter:    ${available - ticketsBooked}`);

  const eventAfter = await getJSON(`/events/${EVENT_ID}`);
  console.log(`\n📋 Event after (DB+Redis):  available_seats = ${eventAfter.body.data?.available_seats}`);

  console.log('\n====================================================\n');
}

run().catch(console.error);
