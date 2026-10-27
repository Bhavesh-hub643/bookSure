'use strict';
const { Router } = require('express');
const { body } = require('express-validator');
const { createCategory, getAllCategories } = require('../controllers/category.controller');

const router = Router();

router.post('/',
  [
    body('name').notEmpty().withMessage('Category name is required'),
    body('description').optional().isString(),
  ],
  createCategory
);

router.get('/', getAllCategories);

module.exports = router;
