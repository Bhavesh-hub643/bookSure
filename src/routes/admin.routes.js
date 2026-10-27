'use strict';
const { Router } = require('express');
const pool = require('../db/pool');
const { spawn } = require('child_process');
const path = require('path');
const CacheService = require('../services/cache.service');

const router = Router();

// POST /admin/reseed
router.post('/reseed', async (req, res) => {
  try {
    // Ensure all test traces are removed
    await pool.query('TRUNCATE TABLE bookings, events, event_images, payments CASCADE');
    await CacheService.flushAll(); 
    
    // Use child process to safely run the seeder script we made earlier
    const seedProcess = spawn('node', [path.join(__dirname, '../../seed-events.js')]);
    
    seedProcess.on('close', (code) => {
      if (code === 0) {
        return res.json({ success: true, message: 'Database wiped and dynamically reseeded! Refresh the page.' });
      } else {
        return res.status(500).json({ success: false, message: 'Seeding script exited with errors.' });
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /admin/test/concurrency -> Server-Sent Events (SSE)
router.get('/test/concurrency', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const { eventId, userId, concurrent = 50, tickets = 1, token = '' } = req.query;

  // Let the client know we're booting it up
  res.write(`data: ${JSON.stringify('Initializing Server-Side Stress Test...\n')}\n\n`);

  // Spawn the existing test suite child process
  const testProcess = spawn('node', [
    path.join(__dirname, '../../tests/concurrency.test.js'), 
    eventId, userId, concurrent, tickets, token
  ]);

  // Pipe stdout and stderr down the SSE line
  testProcess.stdout.on('data', (data) => {
    res.write(`data: ${JSON.stringify(data.toString())}\n\n`);
  });

  testProcess.stderr.on('data', (data) => {
    res.write(`data: ${JSON.stringify(data.toString())}\n\n`);
  });

  // End connection when stress test finishes.
  testProcess.on('close', (code) => {
    res.write(`data: ${JSON.stringify(`\n[Process Finished - Check Results!]`)}\n\n`);
    res.end();
  });
});

module.exports = router;
