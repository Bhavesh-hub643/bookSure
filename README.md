# bookSure

A high-throughput seat reservation backend that prevents overselling when many users try to book the same limited inventory at once.

**Stack:** Node.js, Express, PostgreSQL, Redis, Lua, JWT

---

## The problem

When a popular event goes on sale, thousands of requests hit the same few seats within milliseconds. A naive implementation reads the seat count from the database, checks it, then writes the new count. Under concurrency, two requests can both read "1 seat left" and both succeed, so the event is oversold. Heavy read traffic (people refreshing the availability page) adds extra load on the database.

bookSure addresses both problems:

- **Race conditions:** seat reservation is a single atomic operation, so two requests can never claim the same seat.
- **Read pressure:** event data is served from a Redis cache instead of hitting PostgreSQL on every request.

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
│ counts + │            │ events,    │
│ read     │            │ bookings,  │
│ cache    │            │ payments   │
└──────────┘            └────────────┘
```

| Component | Responsibility |
|-----------|----------------|
| **PostgreSQL** | Source of truth: users, events, bookings, payments. Durable and relational. |
| **Redis** | Holds live seat counts and caches event reads (cache-aside). |
| **Lua script** | Checks and decrements the seat count as one atomic step inside Redis. |
| **JWT** | Authenticates users on protected routes. |

## How a booking works

1. The client sends `POST /bookings` with a valid JWT.
2. The API runs a Lua script in Redis that checks whether enough seats remain and, if so, decrements the count.
3. If there aren't enough seats, the API returns **409 Conflict** immediately, without querying PostgreSQL.
4. If Redis approves the reservation, the API inserts the booking into PostgreSQL.
5. If the PostgreSQL insert fails, the seats are released back in Redis so the count stays correct.

### Why a Lua script?

Doing `GET` followed by `DECRBY` as two separate commands leaves a gap in which another request can run between them. Redis executes a Lua script as one uninterrupted step, so no other command can run in the middle. This makes the check-and-decrement atomic.

```lua
-- KEYS[1] = seat count key, ARGV[1] = tickets requested
local available = tonumber(redis.call('GET', KEYS[1]))
local requested = tonumber(ARGV[1])

if available == nil then
  return -1          -- key missing: seat count not loaded
end

if available >= requested then
  redis.call('DECRBY', KEYS[1], requested)
  return 1           -- reserved
end

return 0             -- not enough seats
```

### Caching (cache-aside)

`GET /events/:id` checks Redis first. On a miss, it reads from PostgreSQL, stores the result in Redis with a TTL, and returns it. Later reads are served from Redis.

## API

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/users/register` | No | Create an account |
| POST | `/users/login` | No | Log in and receive a JWT |
| GET | `/events` | No | List events |
| GET | `/events/:id` | No | Get one event (cached) |
| GET | `/events/:id/availability` | No | Seats remaining |
| POST | `/bookings` | Yes | Reserve seats |
| GET | `/bookings/:id` | Yes | Get your booking |

Send the token as `Authorization: Bearer <token>`.

## Getting started

**Prerequisites:** Node.js 18+, Docker

```bash
# 1. Clone and install
git clone https://github.com/Bhavesh-hub643/bookSure.git
cd bookSure
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start PostgreSQL and Redis
docker compose up -d

# 4. Create tables and seed sample events
npm run migrate
npm run seed

# 5. Start the server
npm start
```

### Run the tests

```bash
npm test                 # correctness tests
npm run test:concurrency # fires simultaneous bookings and checks for oversells
```

## Project structure

```
.
├── src/
│   ├── routes/        # users, events, bookings
│   ├── middleware/    # JWT auth
│   ├── lua/           # reserve-seats script
│   └── db/            # PostgreSQL and Redis clients
├── tests/             # correctness and concurrency tests
├── schema.sql
├── docker-compose.yml
└── .env.example
```

## Design decisions and trade-offs

- **Redis for the hot path, PostgreSQL for durability.** Redis handles the contended counter, while PostgreSQL keeps the permanent record of what actually happened.
- **Seat counts live in Redis.** After a Redis restart the counts must be rebuilt from PostgreSQL (confirmed bookings subtracted from capacity).
- **Reject early.** Requests for a full event are answered from Redis alone, so a rush on a sold-out event doesn't load the database.

## Future work
- Redis-down fallback that counts seats in PostgreSQL.
- Automatic reconcile job to rebuild seat counts after a Redis restart.
