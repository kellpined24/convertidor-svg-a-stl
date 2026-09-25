/**
 * Escritura en Edge Config vía la API REST de Vercel.
 * (La lectura se hace con @vercel/global-config usando process.env.EDGE_CONFIG,
 * que es de solo lectura y ultrarrápida; para escribir hace falta un token
 * de acceso personal de Vercel, ver README de administración.)
 */

function edgeConfigIdFromConnectionString(): string {
  const raw = process.env.EDGE_CONFIG;
  if (!raw) {
    throw new Error(
      'Falta la variable de entorno EDGE_CONFIG. Conecta un Edge Config al proyecto en Vercel (Storage → Create Database → Edge Config).',
    );
  }
  const match = raw.match(/ecfg_[a-zA-Z0-9]+/);
  if (!match) throw new Error('No se pudo leer el identificador del Edge Config desde EDGE_CONFIG.');
  return match[0];
}

export type EdgeConfigOperation = 'create' | 'update' | 'upsert' | 'delete';

export interface EdgeConfigItemPatch {
  operation: EdgeConfigOperation;
  key: string;
  value?: unknown;
}

export async function patchEdgeConfigItems(items: EdgeConfigItemPatch[]): Promise<void> {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) {
    throw new Error(
      'Falta la variable de entorno VERCEL_API_TOKEN (necesaria para que el panel de administración pueda escribir códigos).',
    );
  }
  const edgeConfigId = edgeConfigIdFromConnectionString();

  const url = new URL(`https://api.vercel.com/v1/global-config/${edgeConfigId}/items`);
  if (teamId) url.searchParams.set('teamId', teamId);

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`No se pudo actualizar Edge Config (${res.status}): ${text}`);
  }
}

export async function readAllEdgeConfigItemsFresh(): Promise<Record<string, unknown>> {
  // Lectura "fuerte" (vía API REST, no la caché de borde) — se usa sólo en
  // el panel de administración para ver el estado real tras escribir.
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token) throw new Error('Falta la variable de entorno VERCEL_API_TOKEN.');
  const edgeConfigId = edgeConfigIdFromConnectionString();

  const url = new URL(`https://api.vercel.com/v1/global-config/${edgeConfigId}/items`);
  if (teamId) url.searchParams.set('teamId', teamId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`No se pudo leer Edge Config (${res.status}): ${text}`);
  }
  const items = (await res.json()) as Array<{ key: string; value: unknown }>;
  const out: Record<string, unknown> = {};
  for (const item of items) out[item.key] = item.value;
  return out;
}
