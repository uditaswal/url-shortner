import connectDB from './dbConnection.js'
import { createApp } from './app.js';
import config from './util/config.util.js';
import logger from "./util/logger.util.js";
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const app = createApp();
const PORT = config.port;
await connectDB(config.db.url, config.db.name, config.db.accountLabel);

// Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'URL Shortener API',
            version: '1.0.0',
            description: 'REST API documentation for the URL Shortener application.',
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: 'Local development server'
            }
        ],
    },
    apis: ['./routes/*.js', './index.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI custom options
const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'URL Shortener API Docs',
};

// Add Swagger UI
app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Health check endpoint
/**
 * @swagger
 * /api/health:
 *   get:
 *     tags:
 *       - System
 *     summary: Check API health.
 *     description: Returns a simple status payload so clients and monitors can verify the server is running.
 *     responses:
 *       200:
 *         description: Server health payload.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: UP
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => logger.info(`Server is listening on http://localhost:${PORT}/ at ${new Date().toString()} `));
