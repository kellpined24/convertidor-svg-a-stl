import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClient } from '@vercel/global-config';
import { patchEdgeConfigItems, readAllEdgeConfigItemsFresh, type EdgeConfigItemPatch } from './edgeConfigWrite.js';

export interface CodeRecord {
  itemKey: string; // clave en Edge Config: code_<hmac>
  label: string;
  active: boolean;
  createdAt: number;
  revokedAt?: number;
}

const ITEM_PREFIX = 'code_';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusiones

function getEdgeConfigClient() {
  const raw = process.env.GLOBAL_CONFIG ?? process.env.EDGE_CONFIG;
  if (!raw) throw new Error('Falta la variable de entorno GLOBAL_CONFIG.');
  return createClient(raw);
}

function hmacCode(code: string): string {
  const secret = process.env.CODE_HMAC_SECRET;
  if (!secret) throw new Error('Falta la variable de entorno CODE_HMAC_SECRET.');
  return createHmac('sha256', secret).update(code.trim().toUpperCase()).digest('hex');
}

export function generatePlainCode(): string {
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    if (i === 4) out += '-';
  }
  return out; // ej: A7K9P-QX3RZ
}

/** Verifica un código enviado por una alumna. Lectura rápida (borde). */
export async function verifyCode(
  plainCode: string,
): Promise<{ ok: true; itemKey: string; label: string } | { ok: false }> {
  if (!plainCode || typeof plainCode !== 'string') return { ok: false };
  const hash = hmacCode(plainCode);
  const itemKey = ITEM_PREFIX + hash;
  const client = getEdgeConfigClient();
  const record = (await client.get(itemKey)) as Omit<CodeRecord, 'itemKey'> | undefined;
  if (!record || !record.active) return { ok: false };
  return { ok: true, itemKey, label: record.label };
}

/** Confirma que una sesión existente sigue siendo válida (para revocación instantánea). */
export async function isCodeItemActive(itemKey: string): Promise<boolean> {
  const client = getEdgeConfigClient();
  const record = (await client.get(itemKey)) as Omit<CodeRecord, 'itemKey'> | undefined;
  return !!record?.active;
}

/** Lista completa para el panel de administración (lectura fuerte, no cacheada). */
export async function listCodes(): Promise<CodeRecord[]> {
  const all = await readAllEdgeConfigItemsFresh();
  const out: CodeRecord[] = [];
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(ITEM_PREFIX)) continue;
    out.push({ itemKey: key, ...(value as Omit<CodeRecord, 'itemKey'>) });
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

export async function createCode(label: string): Promise<{ plainCode: string; record: CodeRecord }> {
  const plainCode = generatePlainCode();
  const itemKey = ITEM_PREFIX + hmacCode(plainCode);
  const record: CodeRecord = { itemKey, label: label.trim() || 'Sin nombre', active: true, createdAt: Date.now() };
  const { itemKey: _drop, ...value } = record;
  await patchEdgeConfigItems([{ operation: 'upsert', key: itemKey, value }]);
  return { plainCode, record };
}

export async function setCodeActive(itemKey: string, active: boolean): Promise<void> {
  const client = getEdgeConfigClient();
  const existing = (await client.get(itemKey)) as Omit<CodeRecord, 'itemKey'> | undefined;
  if (!existing) throw new Error('Código no encontrado.');
  const value: Omit<CodeRecord, 'itemKey'> = {
    ...existing,
    active,
    revokedAt: active ? undefined : Date.now(),
  };
  await patchEdgeConfigItems([{ operation: 'update', key: itemKey, value }]);
}

export async function deleteCode(itemKey: string): Promise<void> {
  const patch: EdgeConfigItemPatch = { operation: 'delete', key: itemKey };
  await patchEdgeConfigItems([patch]);
}

/** Reemplaza un código: revoca el actual (invalida sesiones abiertas) y crea uno nuevo con la misma etiqueta. */
export async function replaceCode(itemKey: string): Promise<{ plainCode: string; record: CodeRecord }> {
  const client = getEdgeConfigClient();
  const existing = (await client.get(itemKey)) as Omit<CodeRecord, 'itemKey'> | undefined;
  const label = existing?.label ?? 'Sin nombre';
  await setCodeActive(itemKey, false);
  return createCode(label);
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
