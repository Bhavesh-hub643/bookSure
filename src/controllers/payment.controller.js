'use strict';
const { validationResult } = require('express-validator');
const PaymentModel = require('../models/payment.model');
const BookingModel = require('../models/booking.model');

const createPayment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { booking_id, amount, payment_method, payment_status } = req.body;

    const booking = await BookingModel.findById(booking_id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.user_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'You can only create payments for your own bookings.' });
    }

    const existing = await PaymentModel.findByBooking(booking_id);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Payment already exists for this booking' });
    }

    const payment = await PaymentModel.create({ booking_id, amount, payment_method, payment_status });
    return res.status(201).json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
};

const getPaymentById = async (req, res, next) => {
  try {
    const payment = await PaymentModel.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    if (payment.user_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'You can only access your own payments.' });
    }

    return res.status(200).json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
};

module.exports = { createPayment, getPaymentById };
