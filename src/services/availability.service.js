'use strict';

const EventModel = require('../models/event.model');
const SeatCounterService = require('./seatCounter.service');

async function getEventAvailability(eventId) {
    const event = await EventModel.findById(eventId);
    if (!event) {
        return null;
    }

    let availableSeats = null;
    let seatsSource = 'db';

    try {
        let counter = await SeatCounterService.getAvailable(eventId);

        if (counter === null) {
            const bookedSeats = await EventModel.getBookedSeats(eventId);
            counter = Math.max(event.capacity - bookedSeats, 0);
            await SeatCounterService.init(eventId, counter);
        }

        availableSeats = counter;
        seatsSource = 'redis';
    } catch (redisErr) {
        console.warn('[Cache] Redis unavailable for seat availability, using DB:', redisErr.message);
        const bookedSeats = await EventModel.getBookedSeats(eventId);
        availableSeats = Math.max(event.capacity - bookedSeats, 0);
    }

    return {
        event,
        availableSeats,
        seatsSource,
    };
}

module.exports = { getEventAvailability };