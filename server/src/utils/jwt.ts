import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const signToken = (payload: { id: string; role: string }) => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
};

export const signShortToken = (payload: { id: string; role: string }) => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
};