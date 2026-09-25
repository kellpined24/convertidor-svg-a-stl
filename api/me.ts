import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getStudentToken, verifyStudentSession, clearStudentCookie } from './lib/session.js';
import { isCodeItemActive } from './lib/codes.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = getStudentToken(req.headers.cookie);
  if (!token) {
    res.status(200).json({ authenticated: false });
    return;
  }

  const payload = await verifyStudentSession(token);
  if (!payload) {
    res.setHeader('Set-Cookie', clearStudentCookie());
    res.status(200).json({ authenticated: false });
    return;
  }

  try {
    const active = await isCodeItemActive(payload.itemKey);
    if (!active) {
      res.setHeader('Set-Cookie', clearStudentCookie());
      res.status(200).json({ authenticated: false, reason: 'revoked' });
      return;
    }
    res.status(200).json({ authenticated: true, label: payload.label });
  } catch (err) {
    console.error(err);
    res.status(500).json({ authenticated: false, error: 'Error del servidor.' });
  }
}
