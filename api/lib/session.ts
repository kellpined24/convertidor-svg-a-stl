import { SignJWT, jwtVerify } from 'jose';

const STUDENT_COOKIE = 'svgstl_session';
const ADMIN_COOKIE = 'svgstl_admin';
const STUDENT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 días
const ADMIN_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 horas

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_JWT_SECRET;
  if (!secret) throw new Error('Falta la variable de entorno SESSION_JWT_SECRET.');
  return new TextEncoder().encode(secret);
}

export interface StudentSessionPayload {
  itemKey: string;
  label: string;
}

export async function signStudentSession(payload: StudentSessionPayload): Promise<string> {
  return new SignJWT({ ...payload, kind: 'student' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${STUDENT_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyStudentSession(token: string): Promise<StudentSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.kind !== 'student' || typeof payload.itemKey !== 'string') return null;
    return { itemKey: payload.itemKey, label: String(payload.label ?? '') };
  } catch {
    return null;
  }
}

export async function signAdminSession(): Promise<string> {
  return new SignJWT({ kind: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyAdminSession(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.kind === 'admin';
  } catch {
    return false;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getStudentToken(cookieHeader: string | undefined): string | undefined {
  return parseCookies(cookieHeader)[STUDENT_COOKIE];
}

export function getAdminToken(cookieHeader: string | undefined): string | undefined {
  return parseCookies(cookieHeader)[ADMIN_COOKIE];
}

function cookieString(name: string, value: string, maxAgeSeconds: number): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join('; ');
}

function clearCookieString(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function studentCookie(token: string): string {
  return cookieString(STUDENT_COOKIE, token, STUDENT_MAX_AGE_SECONDS);
}
export function clearStudentCookie(): string {
  return clearCookieString(STUDENT_COOKIE);
}
export function adminCookie(token: string): string {
  return cookieString(ADMIN_COOKIE, token, ADMIN_MAX_AGE_SECONDS);
}
export function clearAdminCookie(): string {
  return clearCookieString(ADMIN_COOKIE);
}
