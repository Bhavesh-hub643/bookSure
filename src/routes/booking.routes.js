'use strict';
const { Router } = require('express');
const { body } = require('express-validator');
const {
  createBooking,
  getBookingById,
  getBookingsByUser,
} = require('../controllers/booking.controller');
const auth = require('../middleware/auth');

const router = Router();

router.post('/',
  auth,
  [
    body('user_id').notEmpty().withMessage('user_id is required'),
    body('event_id').notEmpty().withMessage('event_id is required'),
    body('tickets_count').isInt({ min: 1 }).withMessage('tickets_count must be a positive integer'),
  ],
  createBooking
);

router.get('/:id', auth, getBookingById);

module.exports = router;