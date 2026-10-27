'use strict';
const pool = require('../db/pool');

const BookingModel = {
  async create({ user_id, event_id, tickets_count, status = 'confirmed' }) {
    const { rows } = await pool.query(
      `INSERT INTO bookings (user_id, event_id, tickets_count, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, event_id, tickets_count, status]
    );
    return rows[0];
  },

  async findById(bookingId) {
    const { rows } = await pool.query(
      `SELECT b.*, e.title AS event_title, e.date AS event_date,
              u.name AS user_name, u.email AS user_email
       FROM bookings b
       JOIN events e ON b.event_id = e.event_id
       JOIN users u ON b.user_id = u.user_id
       WHERE b.booking_id = $1`,
      [bookingId]
    );
    return rows[0] || null;
  },

  async findByUser(userId) {
    const { rows } = await pool.query(
      `SELECT b.*, e.title AS event_title, e.date AS event_date, e.location
       FROM bookings b
       JOIN events e ON b.event_id = e.event_id
       WHERE b.user_id = $1
       ORDER BY b.booking_date DESC`,
      [userId]
    );
    return rows;
  },

  async updateStatus(bookingId, status) {
    const { rows } = await pool.query(
      `UPDATE bookings SET status = $1
       WHERE booking_id = $2
       RETURNING *`,
      [status, bookingId]
    );
    return rows[0] || null;
  },
};

module.exports = BookingModel;
