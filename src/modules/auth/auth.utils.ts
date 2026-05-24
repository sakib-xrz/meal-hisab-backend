import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import config from '@/config';

const SALT_ROUNDS = 12;

/**
 * The shape of the JWT payload we sign/verify.
 */
export interface AccessTokenPayload {
  id: string;
  phone: string;
}

/**
 * Hash a plain-text password using bcrypt.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare a plain-text password against a bcrypt hash.
 */
export const comparePassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate a signed access token.
 */
export const generateAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.accessTokenExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwt.accessTokenSecret, options);
};

/**
 * Verify an access token. Throws if invalid/expired.
 */
export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, config.jwt.accessTokenSecret) as AccessTokenPayload;
};
