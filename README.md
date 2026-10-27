# bookSure

A high-throughput seat reservation backend that prevents overselling when many users try to book the same limited inventory at once.

**Stack:** Node.js, Express, PostgreSQL, Redis, Lua, JWT

---

## The problem

When a popular event goes on sale, thousands of requests hit the same few seats within milliseconds. A naive implementation reads the seat count from the database, checks it, then writes the new count. Under concurrency, two requests can both read "1 seat left" and both succeed, so the event is oversold. Heavy read traffic (people refreshing the availability page) adds extra load on the database.

bookSure addresses both problems:

- **Race conditions:** the seat check and decrement is a single atomic Redis operation, so two requests can never claim the same seat.
- **Read pressure:** event rows and lists are served from a Redis cache instead of hitting PostgreSQL on every request.

## Architecture

```
            ┌──────────┐
 Client ──► │ Express  │
            │   API    │
            └────┬─────┘
                 │
     ┌───────────┼────────────┐
     ▼                        ▼
┌──────────┐            ┌────────────┐
│  Redis   │            │ PostgreSQL │
│ seat     │            │ users,     │
│ counters │            │ events,    │
│ + read   │            │ bookings,  │
│ cache    │            │ payments   │
└──────────┘            └────────────┘
```

| Component | Responsibility |
|-----------|----------------|
| **PostgreSQL** | Source of truth: users, events, bookings, payments. Durable and relational. |
| **Redis** | Holds live seat counters and caches event reads (cache-aside). |
| **Lua script** | Checks and decrements the seat counter as one atomic step inside Redis. |
| **JWT** | Authenticates users on protected routes. |

## How a booking works

1. The client sends `POST /bookings` with a valid JWT.
2. The API runs a Lua script in Redis that checks whether enough seats remain and, if so, decrements the counter.
3. If there aren't enough seats (`-1`), the API returns **409 Conflict** immediately, without any PostgreSQL query.
4. If the counter key is missing (`-2`, for example after a Redis restart), the API loads the event and confirmed bookings from PostgreSQL, sets the counter with `SET ... NX` (so a concurrent request can't overwrite it), and retries the script once.
5. Once seats are held in Redis, the API checks the user's booking limit and inserts the booking into PostgreSQL.
6. If the booking limit check or the insert fails, the seats are released back in Redis so the counter stays correct.

### Why a Lua script?

Doing `GET` followed by `DECRBY` as two separate commands leaves a gap in which another request can run between them. Redis executes a Lua script as one uninterrupted step, so no other command can run in the middle. This makes the check-and-decrement atomic.

```lua
-- KEYS[1] = seat counter key, ARGV[1] = tickets requested
local key     = KEYS[1]
local needed  = tonumber(ARGV[1])
local current = tonumber(redis.call('GET', key))

if current == nil then
  return -2          -- key missing: counter not loaded
end

if current < needed then
  return -1          -- not enough seats
end

return redis.call('DECRBY', key, needed)   -- new remaining count
```

The script lives in `src/services/seatCounter.service.js` (`atomicDecrementSafe`).

### Caching (cache-aside)

- `GET /events/:id` checks Redis for the event row first. On a miss it reads from PostgreSQL, stores the row with a TTL, and returns it. Seat counts are always read from the Redis counter, so a cached event row never shows stale availability.
- `GET /events` (paginated list) and `GET /categories` use the same pattern, with their own TTLs. Creating an event or category invalidates the related keys.
- Set `EVENT_CACHE=off` to disable the event-row cache, which is useful for before/after benchmarks.

## API

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/users/register` | No | Create an account |
| POST | `/users/login` | No | Log in and receive a JWT |
| GET | `/users/:id` | Yes | Get your profile and booking summary |
| GET | `/users/:id/bookings` | Yes | List your bookings |
| POST | `/organizers` | No | Create an organizer |
| GET | `/organizers/:id` | No | Get an organizer |
| POST | `/categories` | No | Create a category |
| GET | `/categories` | No | List categories (cached) |
| POST | `/events` | No | Create an event and initialise its seat counter |
| GET | `/events` | No | List events (cached) |
| GET | `/events/:id` | No | Get one event with live seat count (cached) |
| GET | `/events/:id/availability` | No | Seats remaining |
| POST | `/events/:id/images` | No | Add an image URL to an event |
| GET | `/events/:id/images` | No | List an event's images |
| POST | `/bookings` | Yes | Reserve seats |
| GET | `/bookings/:id` | Yes | Get your booking |
| POST | `/payments` | Yes | Record a payment for a booking (see note) |
| GET | `/payments/:id` | Yes | Get your payment |

Send the token as `Authorization: Bearer <token>`.

**Note on payments:** `/payments` only records a payment row. There is no payment gateway, and the amount and status come from the client, so treat it as a placeholder rather than a real payment flow.

**Development-only routes:** `/redis/*` (debug, cache flush) and `/admin/*` (reseed, stress test) are mounted only when `NODE_ENV` is not `production`. They have no authentication and must never be exposed publicly.

**MCP server:** `npm run mcp` starts a small MCP server with one tool, `get_event_seats_left`, which returns the seats left for an event.

## Getting started

**Prerequisites:** Node.js 20+, PostgreSQL, Redis (Docker is the easiest way to run the last two)

```bash
# 1. Clone and install
git clone https://github.com/Bhavesh-hub643/bookSure.git
cd bookSure
npm install

# 2. Configure environment
cp .env.example .env     # then edit DB_PASSWORD and JWT_SECRET

# 3. Start PostgreSQL and Redis (skip if you already run them)
docker run -d --name booksure-pg -p 5432:5432 -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=eventscale postgres:16
docker run -d --name booksure-redis -p 6379:6379 redis:7

# 4. Create tables and seed sample events
npm run migrate
npm run seed

# 5. Start the server
npm start
```

`DB_NAME`, `DB_USER` and `DB_PASSWORD` in `.env` must match the database you created. The `migrate` script assumes the database is named `eventscale` on `localhost` and needs `psql` installed; edit it in `package.json` if yours differs.

The demo UI is a static page: open `frontend/index.html` in a browser while the server runs. Its admin panel (⚡ button) can reseed the database and fire a 50-request concurrency test.

### Run the tests

```bash
npm test                    # API correctness tests (server must be running)
npm run test:concurrency    # 50 simultaneous bookings from one user
npm run test:oversell -- 200 50
                            # 200 different users book 1 ticket each for a 50-seat event,
                            # then checks the confirmed total in PostgreSQL
```

A passing oversell run prints `oversold: 0` and `soldInDb` equal to the event capacity.

## Project structure

```
.
├── src/
│   ├── routes/        # users, organizers, categories, events, bookings, payments, dev-only redis/admin
│   ├── controllers/   # request handling and business logic
│   ├── models/        # PostgreSQL queries
│   ├── services/      # seat counter (Lua), cache, availability
│   ├── middleware/    # JWT auth, error handler
│   ├── db/            # PostgreSQL and Redis clients
│   └── mcp/           # MCP server (seats-left tool)
├── frontend/          # static demo UI
├── schemas/           # TypeScript reference types
├── tests/             # API, concurrency and oversell tests
├── schema.sql
├── seed-events.js
└── .env.example
```

## Design decisions and trade-offs

- **Redis for the hot path, PostgreSQL for durability.** Redis handles the contended counter, while PostgreSQL keeps the permanent record of what actually happened.
- **Reject early.** Requests for a sold-out event are answered from Redis alone, so a rush on a sold-out event doesn't load the database.
- **Reserve first, validate after.** Seats are claimed in Redis before the per-user checks run in PostgreSQL, and are released if those checks or the insert fail.
- **Seat counters live in Redis.** After a Redis restart the counters are rebuilt lazily from PostgreSQL (capacity minus non-cancelled bookings), using `SET ... NX` so concurrent requests don't overwrite each other.
- **PostgreSQL fallback when Redis is down.** The app keeps serving bookings using a plain capacity check in PostgreSQL. **This path is not atomic and can oversell under heavy concurrency**, so the "zero oversells" guarantee applies only while Redis is available.
- **Known gap:** if the process crashes between the Redis decrement and the PostgreSQL insert, the seats stay held in Redis until the counter is rebuilt.
