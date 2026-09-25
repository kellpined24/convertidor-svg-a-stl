import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';

const KEY_LEN = 64;

export function hashAdminPassword(password: string, salt: string): string {
  return scryptSync(password, salt, KEY_LEN).toString('hex');
}

export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

export function verifyAdminPassword(password: string): boolean {
  const salt = process.env.ADMIN_PASSWORD_SALT;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;
  if (!salt || !expectedHash) {
    throw new Error('Faltan ADMIN_PASSWORD_SALT / ADMIN_PASSWORD_HASH en las variables de entorno.');
  }
  const actual = hashAdminPassword(password, salt);
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
