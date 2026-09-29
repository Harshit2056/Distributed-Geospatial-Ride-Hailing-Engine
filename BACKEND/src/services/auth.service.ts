import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import { User, UserRole, AuthTokens, JwtPayload } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';

export class AuthService {
  private static readonly SALT_ROUNDS = 10;

  // Helper method: Tokens generate karna
  private static generateAccessAndRefreshTokens(userId: string, role: UserRole): AuthTokens {
    const accessToken = jwt.sign(
      { userId, role },
      process.env.ACCESS_TOKEN_SECRET || 'access_secret',
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m' }
    );

    const refreshToken = jwt.sign(
      { userId, role },
      process.env.REFRESH_TOKEN_SECRET || 'refresh_secret',
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
    );

    return { accessToken, refreshToken };
  }

  // 1. Register User
  static async registerUser(name: string, email: string, password: string, role: UserRole = 'RIDER'): Promise<Omit<User, 'password_hash' | 'refresh_token'>> {
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    const query = `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at
    `;
    
    try {
      const result = await pool.query(query, [name, email, passwordHash, role]);
      return result.rows[0];
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ApiError(409, 'User with this email already exists');
      }
      throw new ApiError(500, 'Database error during registration');
    }
  }

  // 2. Login User (Dono tokens return karega aur refresh token DB me store karega)
  static async loginUser(email: string, password: string): Promise<{ tokens: AuthTokens; user: Omit<User, 'password_hash' | 'refresh_token'> }> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);

    if (result.rows.length === 0) {
      throw new ApiError(401, 'Invalid email or password credentials');
    }

    const user: User = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new ApiError(401, 'Invalid email or password credentials');
    }

    const { accessToken, refreshToken } = this.generateAccessAndRefreshTokens(user.id, user.role);

    // Refresh token ko database me save karein
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    const { password_hash, refresh_token, ...safeUser } = user;
    return { tokens: { accessToken, refreshToken }, user: safeUser };
  }

  // 3. Refresh Access Token (Jab Access Token expire ho jaye)
  static async refreshAccessToken(incomingRefreshToken: string): Promise<AuthTokens> {
    if (!incomingRefreshToken) {
      throw new ApiError(401, 'Refresh token is required');
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET || 'refresh_secret'
      ) as JwtPayload;
    } catch (error) {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    // Database me check karein ki token match kar raha hai ya revoke ho chuka hai
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await pool.query(query, [decoded.userId]);

    if (result.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }

    const user: User = result.rows[0];

    if (user.refresh_token !== incomingRefreshToken) {
      throw new ApiError(403, 'Refresh token has been revoked or is invalid');
    }

    // Naye tokens generate karein (Token Rotation Strategy)
    const tokens = this.generateAccessAndRefreshTokens(user.id, user.role);

    // Naya refresh token DB me replace karein
    await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [tokens.refreshToken, user.id]);

    return tokens;
  }

  // 4. Logout User (Refresh Token null karke revoke karna)
  static async logoutUser(userId: string): Promise<void> {
    await pool.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [userId]);
  }


  // Current authenticated user ko database se fetch karna
static async getUserById(userId: string): Promise<Omit<User, 'password_hash' | 'refresh_token'>> {
  const query = `
    SELECT id, name, email, role, created_at 
    FROM users 
    WHERE id = $1
  `;
  const result = await pool.query(query, [userId]);

  if (result.rows.length === 0) {
    throw new ApiError(404, 'User does not exist');
  }

  return result.rows[0];
}
}