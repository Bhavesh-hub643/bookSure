'use strict';
const pool = require('../db/pool');

const OrganizerModel = {
  async create({ name, email, phone, organization_name }) {
    const { rows } = await pool.query(
      `INSERT INTO organizers (name, email, phone, organization_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, email, phone, organization_name]
    );
    return rows[0];
  },

  async findById(organizerId) {
    const { rows } = await pool.query(
      `SELECT * FROM organizers WHERE organizer_id = $1`,
      [organizerId]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    const { rows } = await pool.query(
      `SELECT * FROM organizers WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },
};

module.exports = OrganizerModel;
