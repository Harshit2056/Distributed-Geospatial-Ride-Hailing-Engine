import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { AuthService } from '../services/auth.service.js';
import { UserRole } from '../types/auth.types.js';

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

    return res.status(200).json(
      new ApiResponse(200, authData, 'User logged in successfully')
    );
  });
}