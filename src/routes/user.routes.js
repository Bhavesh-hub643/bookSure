'use strict';
const { Router } = require('express');
const { body } = require('express-validator');
const { register, login, getUserById } = require('../controllers/user.controller');
const auth = require('../middleware/auth');

const router = Router();

router.post('/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  register
);

router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

router.get('/:id', auth, getUserById);

module.exports = router;
