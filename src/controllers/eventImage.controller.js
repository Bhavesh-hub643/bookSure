'use strict';
const { validationResult } = require('express-validator');
const EventImageModel = require('../models/eventImage.model');
const EventModel      = require('../models/event.model');

const addImage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const event_id = req.params.id;
    const event = await EventModel.findById(event_id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const { url, alt_text } = req.body;
    const image = await EventImageModel.create({ event_id, url, alt_text });
    return res.status(201).json({ success: true, data: image });
  } catch (err) {
    next(err);
  }
};

const getImagesByEvent = async (req, res, next) => {
  try {
    const event_id = req.params.id;
    const event = await EventModel.findById(event_id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const images = await EventImageModel.findByEvent(event_id);
    return res.status(200).json({ success: true, count: images.length, data: images });
  } catch (err) {
    next(err);
  }
};

module.exports = { addImage, getImagesByEvent };
