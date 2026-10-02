import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JwtPayload } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const verifyJWT = asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
  // 1. Token pehle Authorization header se dhoondhein, warna cookie se lein (accessToken)
  const token =
    req.header('Authorization')?.replace('Bearer ', '').trim() ||
    req.cookies?.accessToken;

  // 2. Agar token nahi mila toh 401 throw karein
  if (!token) {
    throw new ApiError(401, 'Unauthorized request: Missing or invalid token format');
  }

  const secret = process.env.ACCESS_TOKEN_SECRET || 'access_secret';

  try {
    // 3. Direct clean token verify karein
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('JWT Verification Error:', error.name, error.message);
    throw new ApiError(401, 'Invalid or expired access token');
  }
});

// Role-based authorization middleware (e.g. only DRIVER can update location)
export const authorizeRole = (allowedRole: 'RIDER' | 'DRIVER') => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== allowedRole) {
      throw new ApiError(403, `Access denied: Only ${allowedRole}s are allowed to access this resource`);
    }
    next();
  };
};