/**
 * Límite de intentos "best effort" en memoria del proceso de la función.
 * Es una capa adicional a la regla de Vercel Firewall (que es la protección
 * real, ya que persiste entre instancias/regiones); esta sólo ayuda dentro
 * de una misma instancia caliente.
 */
const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 8;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const list = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  attempts.set(key, list);
  return list.length > MAX_ATTEMPTS;
}

export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const fwd = headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  if (Array.isArray(fwd)) return fwd[0];
  return 'unknown';
}
