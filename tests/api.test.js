#!/usr/bin/env node
/**
 * eventSync — Full API Test Suite (Stage 1, 2, 3)
 * --------------------------------------------------
 * Tests every API endpoint in sequence and reports pass/fail.
 * Run AFTER server is started: npm run dev
 *
 * Usage:
 *   node tests/api.test.js
 */
'use strict';
require('dotenv').config();
const http = require('http');

const BASE = `http://localhost:${process.env.PORT || 3000}`;
let passed = 0, failed = 0;
let TOKEN = '', USER_ID = '', ORGANIZER_ID = '', CATEGORY_ID = '';
let EVENT_ID = '', BOOKING_ID = '', PAYMENT_ID = '';

// ─── HTTP helpers ────────────────────────────────────────────────────────────

function request(method, path, body, token) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

const get = (p, t) => request('GET', p, null, t);
const post = (p, b, t) => request('POST', p, b, t);
const del = (p, t) => request('DELETE', p, null, t);

// ─── Test runner ─────────────────────────────────────────────────────────────

async function test(name, fn) {
  try {
    const result = await fn();
    if (result) {
      console.log(`  ✅  ${name}`);
      passed++;
    } else {
      console.log(`  ❌  ${name}`);
      failed++;
    }
  } catch (e) {
    console.log(`  ❌  ${name}  [${e.message}]`);
    failed++;
  }
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║    eventSync API Test Suite                      ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ── Health ──────────────────────────────────────────────────────────────────
  console.log('── Health ──────────────────────────────────────────');
  await test('GET /health returns 200', async () => {
    const r = await get('/health');
    return r.status === 200 && r.body.success;
  });

  // ── Redis (Stage 2) ─────────────────────────────────────────────────────────
  console.log('\n── Redis (Stage 2) ─────────────────────────────────');
  await test('GET /redis/health → Redis PONG', async () => {
    const r = await get('/redis/health');
    return r.status === 200 && r.body.ping === 'PONG';
  });

  await test('GET /redis/keys → lists Redis keys', async () => {
    const r = await get('/redis/keys');
    return r.status === 200 && r.body.success;
  });

  // ── Categories ──────────────────────────────────────────────────────────────
  console.log('\n── Categories ──────────────────────────────────────');
  await test('POST /categories → creates category', async () => {
    const r = await post('/categories', { name: `TestCat_${Date.now()}`, description: 'Test category' });
    if (r.status === 201) { CATEGORY_ID = r.body.data.category_id; return true; }
    return false;
  });

  await test('POST /categories → duplicate name returns 409', async () => {
    await post('/categories', { name: 'DuplicateTest' });
    const r = await post('/categories', { name: 'DuplicateTest' });
    return r.status === 409;
  });

  await test('GET /categories → returns list (cache miss first time)', async () => {
    const r = await get('/categories');
    return r.status === 200 && Array.isArray(r.body.data);
  });

  await test('GET /categories → served from cache on second call', async () => {
    const r = await get('/categories');
    return r.status === 200 && r.body.meta?.source === 'cache';
  });

  // ── Users ───────────────────────────────────────────────────────────────────
  console.log('\n── Users ───────────────────────────────────────────');
  const email = `test_${Date.now()}@example.com`;

  await test('POST /users/register → creates user', async () => {
    const r = await post('/users/register', {
      name: 'Priya Sharma', email, phone: '9876543210', password: 'secret123',
    });
    if (r.status === 201) { USER_ID = r.body.data.user_id; return true; }
    return false;
  });

  await test('POST /users/register → duplicate email returns 409', async () => {
    const r = await post('/users/register', {
      name: 'Dup', email, phone: '1111111111', password: 'secret123',
    });
    return r.status === 409;
  });

  await test('POST /users/register → missing fields returns 400', async () => {
    const r = await post('/users/register', { name: 'Bad' });
    return r.status === 400;
  });

  await test('POST /users/login → returns JWT token', async () => {
    const r = await post('/users/login', { email, password: 'secret123' });
    if (r.status === 200 && r.body.data?.token) {
      TOKEN = r.body.data.token;
      return true;
    }
    return false;
  });

  await test('POST /users/login → wrong password returns 401', async () => {
    const r = await post('/users/login', { email, password: 'wrongpass' });
    return r.status === 401;
  });

  await test('GET /users/:id → returns user (authenticated)', async () => {
    const r = await get(`/users/${USER_ID}`, TOKEN);
    return r.status === 200 && r.body.data?.user_id === USER_ID;
  });

  await test('GET /users/:id → 401 without token', async () => {
    const r = await get(`/users/${USER_ID}`);
    return r.status === 401;
  });

  await test('GET /users/:id → 404 for non-existent user', async () => {
    const r = await get('/users/00000000-0000-0000-0000-000000000000', TOKEN);
    return r.status === 404;
  });

  // ── Organizers ──────────────────────────────────────────────────────────────
  console.log('\n── Organizers ──────────────────────────────────────');
  const orgEmail = `org_${Date.now()}@example.com`;

  await test('POST /organizers → creates organizer', async () => {
    const r = await post('/organizers', {
      name: 'Tata Events', email: orgEmail, phone: '1234567890',
      organization_name: 'Tata Group',
    });
    if (r.status === 201) { ORGANIZER_ID = r.body.data.organizer_id; return true; }
    return false;
  });

  await test('POST /organizers → duplicate email returns 409', async () => {
    const r = await post('/organizers', {
      name: 'Org2', email: orgEmail, organization_name: 'Dup Tata Group',
    });
    return r.status === 409;
  });

  await test('GET /organizers/:id → returns organizer', async () => {
    const r = await get(`/organizers/${ORGANIZER_ID}`);
    return r.status === 200 && r.body.data?.organizer_id === ORGANIZER_ID;
  });

  // ── Events ──────────────────────────────────────────────────────────────────
  console.log('\n── Events ──────────────────────────────────────────');

  await test('POST /events → creates event + primes Redis seat counter', async () => {
    const r = await post('/events', {
      organizer_id: ORGANIZER_ID,
      category_id: CATEGORY_ID,
      title: 'Mumbai Tech Week',
      description: 'An end-to-end test event',
      location: 'Mumbai, MH',
      date: '2027-01-01T10:00:00Z',
      capacity: 5,
      price: 50.00,
    });
    if (r.status === 201) { EVENT_ID = r.body.data.event_id; return true; }
    console.log('   Event create error:', JSON.stringify(r.body));
    return false;
  });

  await test('GET /events → returns list (DB on first call)', async () => {
    const r = await get('/events');
    return r.status === 200 && Array.isArray(r.body.data);
  });

  await test('GET /events → served from cache on second call', async () => {
    const r = await get('/events');
    return r.status === 200 && r.body.meta?.source === 'cache';
  });

  await test('GET /events/:id → returns event with available_seats from Redis', async () => {
    const r = await get(`/events/${EVENT_ID}`);
    return r.status === 200
      && r.body.data?.event_id === EVENT_ID
      && r.body.data?.available_seats === 5
      && r.body.meta?.seats_source === 'redis';
  });

  await test('GET /events/:id/availability → returns basic seat info', async () => {
    const r = await get(`/events/${EVENT_ID}/availability`);
    return r.status === 200
      && r.body.data?.event_id === EVENT_ID
      && r.body.data?.available_seats === 5;
  });

  await test('GET /redis/seats/:id → Redis seat counter = 5', async () => {
    const r = await get(`/redis/seats/${EVENT_ID}`);
    return r.status === 200 && r.body.available_seats === 5;
  });

  await test('POST /events/:id/images → adds image', async () => {
    const r = await post(`/events/${EVENT_ID}/images`, {
      url: 'https://example.com/img.jpg',
      alt_text: 'A test image',
    });
    return r.status === 201;
  });

  await test('GET /events/:id/images → returns images', async () => {
    const r = await get(`/events/${EVENT_ID}/images`);
    return r.status === 200 && r.body.count > 0;
  });

  // ── Bookings (Stage 3 concurrency) ──────────────────────────────────────────
  console.log('\n── Bookings (Stage 3 — Atomic Seat Control) ────────');

  await test('POST /bookings → books 2 tickets atomically (Redis Lua)', async () => {
    const r = await post('/bookings', {
      user_id: USER_ID, event_id: EVENT_ID, tickets_count: 2,
    }, TOKEN);
    if (r.status === 201) {
      BOOKING_ID = r.body.data.booking_id;
      return r.body.meta?.concurrency_control === 'redis-atomic-lua';
    }
    console.log('   error:', JSON.stringify(r.body));
    return false;
  });

  await test('GET /redis/seats/:id → counter decremented to 3', async () => {
    const r = await get(`/redis/seats/${EVENT_ID}`);
    return r.status === 200 && r.body.available_seats === 3;
  });

  await test('POST /bookings → books 3 more tickets (fills event)', async () => {
    const r = await post('/bookings', {
      user_id: USER_ID, event_id: EVENT_ID, tickets_count: 3,
    }, TOKEN);
    return r.status === 201;
  });

  await test('GET /redis/seats/:id → counter = 0 (sold out)', async () => {
    const r = await get(`/redis/seats/${EVENT_ID}`);
    return r.status === 200 && r.body.available_seats === 0;
  });

  await test('POST /bookings → oversell attempt returns 409 (atomic reject)', async () => {
    const r = await post('/bookings', {
      user_id: USER_ID, event_id: EVENT_ID, tickets_count: 1,
    }, TOKEN);
    return r.status === 409;
  });

  await test('GET /redis/seats/:id → counter still 0 after rejection', async () => {
    const r = await get(`/redis/seats/${EVENT_ID}`);
    return r.status === 200 && r.body.available_seats === 0;
  });

  await test('GET /bookings/:id → returns booking', async () => {
    const r = await get(`/bookings/${BOOKING_ID}`, TOKEN);
    return r.status === 200 && r.body.data?.booking_id === BOOKING_ID;
  });

  await test('GET /users/:id/bookings → returns user bookings', async () => {
    const r = await get(`/users/${USER_ID}/bookings`, TOKEN);
    return r.status === 200 && r.body.count >= 1;
  });

  await test('GET /bookings/:id → 401 without token', async () => {
    const r = await get(`/bookings/${BOOKING_ID}`);
    return r.status === 401;
  });

  // ── Payments ────────────────────────────────────────────────────────────────
  console.log('\n── Payments ────────────────────────────────────────');

  await test('POST /payments → creates payment', async () => {
    const r = await post('/payments', {
      booking_id: BOOKING_ID,
      amount: 100.00,
      payment_method: 'card',
      payment_status: 'completed',
    }, TOKEN);
    if (r.status === 201) { PAYMENT_ID = r.body.data.payment_id; return true; }
    console.log('   error:', JSON.stringify(r.body));
    return false;
  });

  await test('POST /payments → duplicate booking payment returns 409', async () => {
    const r = await post('/payments', {
      booking_id: BOOKING_ID, amount: 50, payment_method: 'cash',
    }, TOKEN);
    return r.status === 409;
  });

  await test('GET /payments/:id → returns payment', async () => {
    const r = await get(`/payments/${PAYMENT_ID}`, TOKEN);
    return r.status === 200 && r.body.data?.payment_id === PAYMENT_ID;
  });

  // ── Redis warming ────────────────────────────────────────────────────────────
  console.log('\n── Redis Cache Ops ─────────────────────────────────');

  await test('POST /redis/seats/:id/warm → warm counter from DB', async () => {
    await del('/redis/cache'); // flush redis first
    const r = await request('POST', `/redis/seats/${EVENT_ID}/warm`);
    return r.status === 200 && r.body.available_seats === 0;
  });

  await test('DELETE /redis/cache → flushes Redis DB', async () => {
    const r = await del('/redis/cache');
    return r.status === 200 && r.body.success;
  });

  await test('GET /events → DB fallback after cache flush (source: db)', async () => {
    const r = await get('/events');
    return r.status === 200 && r.body.meta?.source === 'db';
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} passed ${failed > 0 ? `(${failed} FAILED)` : '✅ All passed!'}`);
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
