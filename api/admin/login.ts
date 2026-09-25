import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdminPassword } from '../lib/adminAuth.js';
import { signAdminSession, adminCookie } from '../lib/session.js';
import { isRateLimited, clientIp } from '../lib/rateLimit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }

  const ip = clientIp(req.headers);
  if (isRateLimited(`admin-login:${ip}`)) {
    res.status(429).json({ ok: false, error: 'Demasiados intentos. Espera un minuto.' });
    return;
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  const password = body?.password;
  if (!password || typeof password !== 'string') {
    res.status(400).json({ ok: false, error: 'Escribe la contraseña de administración.' });
    return;
  }

  try {
    if (!verifyAdminPassword(password)) {
      res.status(401).json({ ok: false, error: 'Contraseña incorrecta.' });
      return;
    }
    const token = await signAdminSession();
    res.setHeader('Set-Cookie', adminCookie(token));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Error del servidor.' });
  }
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
