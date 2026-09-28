import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { pool } from '../config/db.js';
import { User, UserRole } from '../types/auth.types.js';
import { ApiError } from '../utils/ApiError.js';

export class AuthService {
  private static readonly SALT_ROUNDS = 10;
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

  static async registerUser(name: string, email: string, password: string, role: UserRole = 'RIDER'): Promise<Omit<User, 'password_hash'>> {
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

  static async loginUser(email: string, password: string): Promise<{ token: string; user: Omit<User, 'password_hash'> }> {
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

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      this.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const { password_hash, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  }
}