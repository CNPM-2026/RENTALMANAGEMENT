import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import crypto from 'crypto';

export const signToken = (payload: { id: string; role: string }) => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
};

export const signShortToken = (payload: { id: string; role: string }) => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
};

export const signGoogleOAuthState = () => jwt.sign(
  { purpose: 'google-oauth', nonce: crypto.randomBytes(16).toString('hex') },
  env.JWT_SECRET,
  { expiresIn: '10m' },
);

export const verifyGoogleOAuthState = (state: string) => {
  const payload = jwt.verify(state, env.JWT_SECRET) as { purpose?: string };
  if (payload.purpose !== 'google-oauth') throw new Error('Invalid OAuth state');
};