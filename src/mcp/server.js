'use strict';

require('dotenv').config();
const { McpServer } = require('@modelcontextprotocol/server');
const { StdioServerTransport } = require('@modelcontextprotocol/server/stdio');
const { z } = require('zod');
const pool = require('../db/pool');
const { getEventAvailability } = require('../services/availability.service');

async function start() {
    await pool.query('SELECT 1');

    const server = new McpServer({ name: 'eventSync', version: '1.0.0' });

    server.registerTool(
        'get_event_seats_left',
        {
            description: 'Get how many seats are left for a specific event.',
            inputSchema: z.object({ eventId: z.string().describe('The event UUID') }),
        },
        async ({ eventId }) => {
            const availability = await getEventAvailability(eventId);

            if (!availability) {
                return {
                    content: [{ type: 'text', text: `Event ${eventId} was not found.` }],
                    isError: true,
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                eventId: availability.event.event_id,
                                title: availability.event.title,
                                capacity: availability.event.capacity,
                                availableSeats: availability.availableSeats,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        }
    );

    await server.connect(new StdioServerTransport());
}

start().catch((err) => {
    console.error('MCP server failed to start:', err.message);
    process.exit(1);
});