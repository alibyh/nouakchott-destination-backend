import express from 'express';
import { config } from './config/env';
import destinationRoute from './routes/destinationRoute';

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'hassaniya-destination-api' });
});

// Mount API routes
app.use('/api', destinationRoute);

// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: 'The requested endpoint does not exist',
    });
});

// Start server - bind to 0.0.0.0 to accept external connections (from iPhone)
const PORT = config.port;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║  Hassaniya Arabic Destination Service                     ║
║  Server running on http://${HOST}:${PORT}                       ║
║                                                            ║
║  Endpoints:                                                ║
║  - GET  /health                                            ║
║  - POST /api/destination-from-audio                        ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[Server] Shutting down gracefully...');
    process.exit(0);
});
