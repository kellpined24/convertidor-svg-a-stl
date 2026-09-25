import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyCode } from './lib/codes';
import { signStudentSession, studentCookie } from './lib/session';
import { isRateLimited, clientIp } from './lib/rateLimit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido.' });
    return;
  }

  const ip = clientIp(req.headers);
  if (isRateLimited(`login:${ip}`)) {
    res.status(429).json({ ok: false, error: 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.' });
    return;
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  const code = body?.code;

  if (!code || typeof code !== 'string') {
    res.status(400).json({ ok: false, error: 'Escribe tu código de acceso.' });
    return;
  }

  try {
    const result = await verifyCode(code);
    if (!result.ok) {
      res.status(401).json({ ok: false, error: 'Código inválido o revocado.' });
      return;
    }

    const token = await signStudentSession({ itemKey: result.itemKey, label: result.label });
    res.setHeader('Set-Cookie', studentCookie(token));
    res.status(200).json({ ok: true, label: result.label });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error del servidor al verificar el código.' });
    console.error(err);
  }
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
