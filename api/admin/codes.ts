import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminToken, verifyAdminSession } from '../lib/session';
import { listCodes, createCode, setCodeActive, deleteCode, replaceCode } from '../lib/codes';

async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const token = getAdminToken(req.headers.cookie);
  if (!token || !(await verifyAdminSession(token))) {
    res.status(401).json({ ok: false, error: 'No autenticado como administrador.' });
    return false;
  }
  return true;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireAdmin(req, res))) return;

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;

  try {
    if (req.method === 'GET') {
      const codes = await listCodes();
      res.status(200).json({ ok: true, codes });
      return;
    }

    if (req.method === 'POST') {
      const label = String(body?.label ?? '').slice(0, 80);
      const { plainCode, record } = await createCode(label);
      res.status(201).json({ ok: true, plainCode, record });
      return;
    }

    if (req.method === 'PATCH') {
      const itemKey = String(body?.itemKey ?? '');
      const action = body?.action;
      if (!itemKey) {
        res.status(400).json({ ok: false, error: 'Falta itemKey.' });
        return;
      }
      if (action === 'revoke') {
        await setCodeActive(itemKey, false);
        res.status(200).json({ ok: true });
        return;
      }
      if (action === 'reactivate') {
        await setCodeActive(itemKey, true);
        res.status(200).json({ ok: true });
        return;
      }
      if (action === 'replace') {
        const { plainCode, record } = await replaceCode(itemKey);
        res.status(200).json({ ok: true, plainCode, record });
        return;
      }
      res.status(400).json({ ok: false, error: 'Acción desconocida.' });
      return;
    }

    if (req.method === 'DELETE') {
      const itemKey = String(body?.itemKey ?? '');
      if (!itemKey) {
        res.status(400).json({ ok: false, error: 'Falta itemKey.' });
        return;
      }
      await deleteCode(itemKey);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: 'Método no permitido.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Error del servidor.' });
  }
}
