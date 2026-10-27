'use strict';
const { Router } = require('express');
const { body } = require('express-validator');
const { addImage, getImagesByEvent } = require('../controllers/eventImage.controller');

const router = Router({ mergeParams: true });

router.post('/',
  [
    body('url').notEmpty().isURL().withMessage('Valid image URL is required'),
    body('alt_text').optional().isString(),
  ],
  addImage
);

router.get('/', getImagesByEvent);

module.exports = router;
