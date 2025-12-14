import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const windowMs = config.rateLimitWindowMs;
  const max = config.rateLimitMax;

  // Best-effort client key. Express may trust proxy depending on deployment.
  const key = req.ip || 'unknown';

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  existing.count += 1;
  if (existing.count > max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
      retryAfterSeconds,
    });
  }

  return next();
}


