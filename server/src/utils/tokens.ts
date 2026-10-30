import crypto from 'crypto';

export const createOpaqueToken = () => crypto.randomBytes(32).toString('hex');
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
