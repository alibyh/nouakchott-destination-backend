import express from 'express';
import { config } from './config/env';
import destinationRoute from './routes/destinationRoute';
import { requireBearerAuth } from './middleware/auth';
import { rateLimit } from './middleware/rateLimit';
import multer from 'multer';

// Initialize Express app
const app = express();
app.disable('x-powered-by');

// CORS middleware (allow all origins for API access)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic request logging (safe, no bodies)
app.use((req, _res, next) => {
    const start = Date.now();
    resOnFinish(_res, () => {
        const ms = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.originalUrl} ${_res.statusCode} ${ms}ms`);
    });
    next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'hassaniya-destination-api' });
});

// Mount API routes
app.use('/api', requireBearerAuth, rateLimit, destinationRoute);

// Error handler (multer + generic)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            error: 'UPLOAD_FAILED',
            message: err.message,
            code: err.code,
        });
    }

    if (err instanceof Error) {
        // Common fileFilter errors
        if (err.message.includes('Only audio files are allowed')) {
            return res.status(400).json({
                error: 'INVALID_FILE_TYPE',
                message: err.message,
            });
        }
        return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: err.message,
        });
    }

    return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Unknown error',
    });
});

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

function resOnFinish(res: express.Response, cb: () => void) {
    res.once('finish', cb);
    res.once('close', cb);
}
