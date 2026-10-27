'use strict';
const { Router } = require('express');
const { body } = require('express-validator');
const { createPayment, getPaymentById } = require('../controllers/payment.controller');
const auth = require('../middleware/auth');

const router = Router();

router.post('/',
  auth,
  [
    body('booking_id').notEmpty().withMessage('booking_id is required'),
    body('amount').isFloat({ min: 0 }).withMessage('amount must be a non-negative number'),
    body('payment_method').optional().notEmpty().withMessage('payment_method cannot be empty if provided'),
    body('payment_status')
      .optional()
      .isIn(['pending', 'completed', 'failed', 'refunded'])
      .withMessage('Invalid payment_status'),
  ],
  createPayment
);

router.get('/:id', auth, getPaymentById);

module.exports = router;
