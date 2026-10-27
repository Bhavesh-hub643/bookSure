'use strict';
const pool = require('../db/pool');

const EventImageModel = {
  async create({ event_id, url, alt_text }) {
    const { rows } = await pool.query(
      `INSERT INTO event_images (event_id, url, alt_text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [event_id, url, alt_text || null]
    );
    return rows[0];
  },

  async findByEvent(eventId) {
    const { rows } = await pool.query(
      `SELECT * FROM event_images WHERE event_id = $1 ORDER BY image_id`,
      [eventId]
    );
    return rows;
  },
};

module.exports = EventImageModel;
