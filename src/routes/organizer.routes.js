'use strict';
const { Router } = require('express');
const { body } = require('express-validator');
const { createOrganizer, getOrganizerById } = require('../controllers/organizer.controller');

const router = Router();

router.post('/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('organization_name').notEmpty().withMessage('Organization name is required'),
  ],
  createOrganizer
);

router.get('/:id', getOrganizerById);

module.exports = router;
