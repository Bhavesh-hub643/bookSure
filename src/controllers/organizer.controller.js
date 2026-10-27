'use strict';
const { validationResult } = require('express-validator');
const OrganizerModel = require('../models/organizer.model');

const createOrganizer = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, phone, organization_name } = req.body;

    const existing = await OrganizerModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered for an organizer' });
    }

    const organizer = await OrganizerModel.create({ name, email, phone, organization_name });
    return res.status(201).json({ success: true, data: organizer });
  } catch (err) {
    next(err);
  }
};

const getOrganizerById = async (req, res, next) => {
  try {
    const organizer = await OrganizerModel.findById(req.params.id);
    if (!organizer) {
      return res.status(404).json({ success: false, message: 'Organizer not found' });
    }
    return res.status(200).json({ success: true, data: organizer });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrganizer, getOrganizerById };
