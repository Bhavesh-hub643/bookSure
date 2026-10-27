'use strict';
/**
 * Category Controller — Stage 2
 * Adds Redis cache-aside for GET /categories
 */
const { validationResult } = require('express-validator');
const CategoryModel = require('../models/category.model');
const CacheService  = require('../services/cache.service');

// POST /categories
const createCategory = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, description } = req.body;

    const existing = await CategoryModel.findByName(name);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Category with this name already exists' });
    }

    const category = await CategoryModel.create({ name, description });

    // Invalidate cached categories list
    CacheService.invalidateCategories().catch(() => {});

    return res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

// GET /categories
const getAllCategories = async (req, res, next) => {
  try {
    // Stage 2: Cache-aside
    try {
      const cached = await CacheService.getCategories();
      if (cached) {
        return res.status(200).json({
          success: true, count: cached.length, data: cached,
          meta: { source: 'cache' },
        });
      }
    } catch (_) {}

    const categories = await CategoryModel.findAll();
    CacheService.setCategories(categories).catch(() => {});

    return res.status(200).json({
      success: true, count: categories.length, data: categories,
      meta: { source: 'db' },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createCategory, getAllCategories };
