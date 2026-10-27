'use strict';
const pool = require('../db/pool');

const UserModel = {
  /**
   * Create a new user (password should be pre-hashed)
   */
  async create({ name, email, phone, password }) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, password)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, email, phone, booking_limit, created_at`,
      [name, email, phone, password]
    );
    return rows[0];
  },

  /**
   * Find a user by email (includes password for auth)
   */
  async findByEmail(email) {
    const { rows } = await pool.query(
      `SELECT user_id, name, email, phone, password, booking_limit, created_at
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Find a user by ID (excludes password)
   */
  async findById(userId) {
    const { rows } = await pool.query(
      `SELECT user_id, name, email, phone, booking_limit, created_at
       FROM users WHERE user_id = $1`,
      [userId]
    );
    return rows[0] || null;
  },

  async getBookingSummary(userId) {
    const { rows } = await pool.query(
      `SELECT u.booking_limit,
              COALESCE(COUNT(b.booking_id) FILTER (WHERE b.status != 'cancelled'), 0) AS active_bookings
       FROM users u
       LEFT JOIN bookings b ON b.user_id = u.user_id
       WHERE u.user_id = $1
       GROUP BY u.user_id`,
      [userId]
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const bookingLimit = parseInt(row.booking_limit, 10);
    const activeBookings = parseInt(row.active_bookings, 10);

    return {
      booking_limit: bookingLimit,
      active_bookings: activeBookings,
      remaining_bookings: Math.max(bookingLimit - activeBookings, 0),
    };
  },
};

module.exports = UserModel;
