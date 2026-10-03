import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis.js';
import { ApiError } from '../utils/ApiError.js';

interface RateLimitOptions {
  windowInSeconds: number;
  maxRequests: number;
  keyPrefix?: string;
}

export const rateLimiter = (options: RateLimitOptions) => {
  const { windowInSeconds, maxRequests, keyPrefix = 'rl' } = options;

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // User ID se limit karein agar authenticated hai, warna Client IP se
      const identifier = (req as any).user?.userId || req.ip || 'anonymous';
      const redisKey = `${keyPrefix}:${identifier}`;

      const currentCount = await redis.incr(redisKey);

      // Agar pehli request hai toh window expiry set karein
      if (currentCount === 1) {
        await redis.expire(redisKey, windowInSeconds);
      }

      if (currentCount > maxRequests) {
        throw new ApiError(
          429,
          `Too many requests. Please try again after ${windowInSeconds} seconds.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};