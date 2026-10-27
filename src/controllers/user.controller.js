'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const UserModel = require('../models/user.model');

const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, phone, password } = req.body;

    const existing = await UserModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await UserModel.create({ name, email, phone, password: hashedPassword });

    return res.status(201).json({
      success: true,
      data: {
        ...user,
        booking_summary: {
          booking_limit: user.booking_limit,
          active_bookings: 0,
          remaining_bookings: user.booking_limit,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.user_id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const bookingSummary = await UserModel.getBookingSummary(user.user_id);

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          booking_limit: user.booking_limit,
          created_at: user.created_at,
        },
        booking_summary: bookingSummary,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'You can only access your own profile.' });
    }

    const bookingSummary = await UserModel.getBookingSummary(user.user_id);

    return res.status(200).json({
      success: true,
      data: {
        ...user,
        booking_summary: bookingSummary,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getUserById };
