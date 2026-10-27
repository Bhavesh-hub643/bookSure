'use strict';

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);

  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Duplicate entry: ' + err.detail });
  }

  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced resource does not exist.' });
  }

  if (err.code === '23514') {
    return res.status(400).json({ success: false, message: 'Data violates a check constraint: ' + err.detail });
  }

  const statusCode = err.statusCode || 500;
  const message    = err.message    || 'Internal Server Error';

  res.status(statusCode).json({ success: false, message });
};

module.exports = errorHandler;
