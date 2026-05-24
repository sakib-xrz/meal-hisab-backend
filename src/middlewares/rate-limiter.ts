import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for login endpoint
 * 5 attempts per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => {
    // Skip rate limiting in development environment
    return process.env.NODE_ENV === 'development';
  },
});

/**
 * Rate limiter for public order tracking endpoint
 * 30 attempts per 15 minutes per IP
 */
export const orderTrackingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: {
    success: false,
    message: 'Too many attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => {
    // Skip rate limiting in development environment
    return process.env.NODE_ENV === 'development';
  },
});
