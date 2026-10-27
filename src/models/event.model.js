'use strict';
const pool = require('../db/pool');

const EventModel = {
  async create({ organizer_id, category_id, title, description, location, date, capacity, price }) {
    const { rows } = await pool.query(
      `INSERT INTO events
         (organizer_id, category_id, title, description, location, date, capacity, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [organizer_id, category_id || null, title, description, location, date, capacity, price]
    );
    return rows[0];
  },

  async findAll({ limit = 20, offset = 0 } = {}) {
    const { rows } = await pool.query(
      `SELECT e.*, o.name AS organizer_name, o.organization_name,
              c.name AS category_name
       FROM events e
       LEFT JOIN organizers o ON e.organizer_id = o.organizer_id
       LEFT JOIN event_categories c ON e.category_id = c.category_id
       ORDER BY e.date ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  },

  async findById(eventId) {
    const { rows } = await pool.query(
      `SELECT e.*, o.name AS organizer_name, o.organization_name,
              c.name AS category_name
       FROM events e
       LEFT JOIN organizers o ON e.organizer_id = o.organizer_id
       LEFT JOIN event_categories c ON e.category_id = c.category_id
       WHERE e.event_id = $1`,
      [eventId]
    );
    return rows[0] || null;
  },

  async getBookedSeats(eventId) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(tickets_count), 0) AS booked
       FROM bookings
       WHERE event_id = $1 AND status != 'cancelled'`,
      [eventId]
    );
    return parseInt(rows[0].booked, 10);
  },
};

module.exports = EventModel;
