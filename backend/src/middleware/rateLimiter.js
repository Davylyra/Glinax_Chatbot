/**
 * RATE LIMITING MIDDLEWARE
 * Production-ready rate limiting for API endpoints
 */

import rateLimit from 'express-rate-limit';

// General API rate limiter - 100 requests per 15 minutes
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(res.getHeader('Retry-After') / 60) + ' minutes'
    });
  }
});

// Authentication rate limiter - More restrictive
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.ceil(res.getHeader('Retry-After') / 60) + ' minutes'
    });
  }
});

// Chat/Messages rate limiter - Moderate
export const chatRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit to 30 messages per minute
  message: {
    success: false,
    message: 'Too many messages, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Payment rate limiter - Very restrictive
export const paymentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit to 10 payment attempts per hour
  message: {
    success: false,
    message: 'Too many payment attempts, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many payment attempts, please try again later.',
      retryAfter: Math.ceil(res.getHeader('Retry-After') / 3600) + ' hours'
    });
  }
});

// File upload rate limiter - Restrictive
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit to 10 uploads per window
  message: {
    success: false,
    message: 'Too many file uploads, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Webhook rate limiter - Very permissive (for Paystack)
export const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow many webhook calls
  message: {
    success: false,
    message: 'Webhook rate limit exceeded'
  },
  standardHeaders: false,
  legacyHeaders: false,
  skipFailedRequests: true, // Don't count failed requests
  skipSuccessfulRequests: true // Don't count successful requests
});

export default {
  generalRateLimit,
  authRateLimit,
  chatRateLimit,
  paymentRateLimit,
  uploadRateLimit,
  webhookRateLimit
};

export const rateLimiters = {
  generalRateLimit,
  authRateLimit,
  chatRateLimit,
  paymentRateLimit,
  uploadRateLimit,
  webhookRateLimit
};
