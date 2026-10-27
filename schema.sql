-- ============================================================
-- EventScale Database Schema
-- PostgreSQL
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. Event Categories
-- Must be created before Events (FK dependency)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_categories (
  category_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL UNIQUE,
  description   TEXT
);

-- ============================================================
-- 2. Organizers
-- Must be created before Events (FK dependency)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizers (
  organizer_id      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(150)  NOT NULL,
  email             VARCHAR(255)  NOT NULL UNIQUE,
  phone             VARCHAR(20),
  organization_name VARCHAR(200)  NOT NULL
);

-- ============================================================
-- 3. Users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  user_id     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150)  NOT NULL,
  email       VARCHAR(255)  NOT NULL UNIQUE,
  phone       VARCHAR(20),
  password    TEXT          NOT NULL,
  booking_limit INTEGER      NOT NULL DEFAULT 10 CHECK (booking_limit > 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. Events
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  event_id      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id  UUID           NOT NULL REFERENCES organizers(organizer_id) ON DELETE CASCADE,
  category_id   UUID           REFERENCES event_categories(category_id) ON DELETE SET NULL,
  title         VARCHAR(255)   NOT NULL,
  description   TEXT,
  location      VARCHAR(300),
  date          TIMESTAMPTZ    NOT NULL,
  capacity      INTEGER        NOT NULL CHECK (capacity > 0),
  price         NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- ============================================================
-- 5. Bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  booking_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_id      UUID        NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  booking_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tickets_count INTEGER     NOT NULL CHECK (tickets_count > 0),
  status        VARCHAR(50) NOT NULL DEFAULT 'confirmed'
                            CHECK (status IN ('confirmed', 'cancelled', 'pending'))
);

-- ============================================================
-- 6. Payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  payment_id       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID           NOT NULL UNIQUE REFERENCES bookings(booking_id) ON DELETE CASCADE,
  amount           NUMERIC(10, 2) NOT NULL,
  payment_method   VARCHAR(50),
  payment_status   VARCHAR(50)    NOT NULL DEFAULT 'pending'
                                  CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_time TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. Event Images
-- ============================================================
CREATE TABLE IF NOT EXISTS event_images (
  image_id  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  UUID  NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  url       TEXT  NOT NULL,
  alt_text  VARCHAR(255)
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_organizer    ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_category     ON events(category_id);
CREATE INDEX IF NOT EXISTS idx_events_date         ON events(date);
CREATE INDEX IF NOT EXISTS idx_bookings_user       ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event      ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_event_images_event  ON event_images(event_id);
