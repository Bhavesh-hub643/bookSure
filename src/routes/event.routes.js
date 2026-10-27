'use strict';
const { Router } = require('express');
const { body } = require('express-validator');
const {
  createEvent,
  getAllEvents,
  getEventById,
  getEventAvailabilityEndpoint,
} = require('../controllers/event.controller');
const eventImageRoutes = require('./eventImage.routes');

const router = Router();

router.use('/:id/images', eventImageRoutes);

router.post('/',
  [
    body('organizer_id').notEmpty().withMessage('organizer_id is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('date').isISO8601().withMessage('Valid date (ISO 8601) is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be a positive integer'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  ],
  createEvent
);

router.get('/', getAllEvents);

router.get('/:id/availability', getEventAvailabilityEndpoint);

router.get('/:id', getEventById);

module.exports = router;
