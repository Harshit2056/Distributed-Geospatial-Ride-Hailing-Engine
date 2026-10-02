import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthService } from '../services/auth.service.js';
import { UserRole, AuthRequest } from '../types/auth.types.js';

const accessTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 15 * 60 * 1000, // 15 Minutes
};

// Production Cookie Settings
const refreshTokencookieOptions = {
  httpOnly: true, // JavaScript client-side is cookie ko chori nahi kar sakta (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict' as const, // CSRF attacks prevention
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Days in milliseconds
};

export class AuthController {
  static register = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      throw new ApiError(400, 'Name, email, and password are required fields');
    }

    const userRole: UserRole = role === 'DRIVER' ? 'DRIVER' : 'RIDER';
    const user = await AuthService.registerUser(name, email, password, userRole);

    return res.status(201).json(
      new ApiResponse(201, user, 'User registered successfully')
    );
  });

  static login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'Email and password are required');
    }

    const authData = await AuthService.loginUser(email, password);

    

    // Refresh token ko direct HTTP-Only cookie mein attach karna
    res.cookie('refreshToken', authData.tokens.refreshToken, refreshTokencookieOptions);
    res.cookie('accessToken', authData.tokens.accessToken, accessTokenCookieOptions)
        

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          accessToken: authData.tokens.accessToken,
          user: authData.user,
        },
        'User logged in successfully'
      )
    );
  });

  static refresh = asyncHandler(async (req: Request, res: Response) => {

    const incomingRefreshToken =
      req.cookies?.refreshToken ||
      req.headers['x-refresh-token'] ||
      req.body?.refreshToken;

    if (!incomingRefreshToken) {
      throw new ApiError(401, 'Refresh token not found in cookies or headers');
    }

    const newTokens = await AuthService.refreshAccessToken(incomingRefreshToken as string);

    // Naya refresh token wapas cookie mein replace kar do (Token Rotation)
    res.cookie('refreshToken', newTokens.refreshToken, refreshTokencookieOptions);
    

    return res.status(200).json(
      new ApiResponse(
        200,
        { accessToken: newTokens.accessToken },
        'Access token refreshed successfully'
      )
    );
  });

  static logout = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.user?.userId) {
      await AuthService.logoutUser(req.user.userId);
    }

    const options = {
        httpOnly:true,
        secure:true
    }

    // Cookie ko destroy/clear karna
    res.clearCookie('refreshToken', options);

    return res.status(200).json(
      new ApiResponse(200, null, 'User logged out successfully')
    );
  });

static getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ApiError(401, 'Unauthorized request: Missing user identity');
  }

  const user = await AuthService.getUserById(userId);

  return res.status(200).json(
    new ApiResponse(200, user, 'Current user profile fetched successfully')
  );
});
}