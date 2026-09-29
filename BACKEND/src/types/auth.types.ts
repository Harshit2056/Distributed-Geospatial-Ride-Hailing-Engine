import { Request } from 'express';

export type UserRole = 'RIDER' | 'DRIVER';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  refresh_token?: string | null;
  created_at: Date;
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}