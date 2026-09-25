import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearStudentCookie } from './lib/session.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }
  res.setHeader('Set-Cookie', clearStudentCookie());
  res.status(200).json({ ok: true });
}
