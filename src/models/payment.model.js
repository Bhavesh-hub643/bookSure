'use strict';
const pool = require('../db/pool');

const PaymentModel = {
  async create({ booking_id, amount, payment_method, payment_status = 'pending' }) {
    const { rows } = await pool.query(
      `INSERT INTO payments (booking_id, amount, payment_method, payment_status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [booking_id, amount, payment_method, payment_status]
    );
    return rows[0];
  },

  async findById(paymentId) {
    const { rows } = await pool.query(
      `SELECT p.*, b.user_id, b.event_id, b.tickets_count
       FROM payments p
       JOIN bookings b ON p.booking_id = b.booking_id
       WHERE p.payment_id = $1`,
      [paymentId]
    );
    return rows[0] || null;
  },

  async findByBooking(bookingId) {
    const { rows } = await pool.query(
      `SELECT * FROM payments WHERE booking_id = $1`,
      [bookingId]
    );
    return rows[0] || null;
  },
};

module.exports = PaymentModel;
