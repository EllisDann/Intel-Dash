import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { query } from './db';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const TOKEN_EXPIRATION = '7d';

export interface JwtUser {
  sub: string;
  tenant_id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, passwordHash: string) => {
  return bcrypt.compare(password, passwordHash);
};

export const createJwtToken = (payload: Omit<JwtUser, 'iat' | 'exp'>) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
};

export const verifyJwtToken = (token: string) => {
  return jwt.verify(token, JWT_SECRET) as JwtUser;
};

export const createSession = async (userId: string, token: string) => {
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const result = await query(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id',
    [userId, tokenHash, expiresAt.toISOString()]
  );
  return result.rows[0];
};

export const createUserSession = async (userId: string) => {
  const token = createJwtToken({
    sub: userId,
    tenant_id: userId,
    email: '',
    role: 'viewer',
  });
  return createSession(userId, token);
};
