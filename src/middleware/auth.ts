import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export function requireBearerAuth(req: Request, res: Response, next: NextFunction) {
  // If AUTH_TOKEN is not set, auth is disabled.
  if (!config.authToken) return next();

  const header = req.header('authorization') || '';
  const expected = `Bearer ${config.authToken}`;

  if (header !== expected) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid Authorization header',
    });
  }

  return next();
}


