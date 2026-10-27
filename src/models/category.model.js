'use strict';
const pool = require('../db/pool');

const CategoryModel = {
  async create({ name, description }) {
    const { rows } = await pool.query(
      `INSERT INTO event_categories (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name, description || null]
    );
    return rows[0];
  },

  async findAll() {
    const { rows } = await pool.query(
      `SELECT * FROM event_categories ORDER BY name`
    );
    return rows;
  },

  async findById(categoryId) {
    const { rows } = await pool.query(
      `SELECT * FROM event_categories WHERE category_id = $1`,
      [categoryId]
    );
    return rows[0] || null;
  },

  async findByName(name) {
    const { rows } = await pool.query(
      `SELECT * FROM event_categories WHERE LOWER(name) = LOWER($1)`,
      [name]
    );
    return rows[0] || null;
  },
};

module.exports = CategoryModel;
