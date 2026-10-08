/**
 * Fórmula de la calculadora de costos de impresión 3D.
 * Sin DOM — fácil de probar. Todos los importes en la moneda elegida.
 */

export interface CostInput {
  spoolPrice: number; // precio de la bobina
  spoolKg: number; // peso de la bobina (kg)
  peso: number; // filamento usado por pieza (g)
  horas: number; // tiempo de impresión por pieza (h)
  watts: number; // consumo de la impresora (W)
  kwh: number; // precio de la luz por kWh
  impPrecio: number; // costo de la impresora
  impVida: number; // vida útil esperada (h)
  cant: number; // cantidad de piezas
  fallos: number; // margen por fallos (%)
  margen: number; // ganancia deseada (%)
  comision: number; // comisión de plataforma (%)
  impuesto: number; // impuestos (%)
  multi: boolean; // multicolor: +20 % de filamento por purga
}

export interface CostResult {
  cant: number;
  /** [filamento, electricidad, desgaste, fallos] para todas las piezas */
  partes: [number, number, number, number];
  costo: number;
  comision: number;
  impuesto: number;
  precio: number;
  ganancia: number;
}

export const PARTES: ReadonlyArray<readonly [string, string]> = [
  ['Filamento', '#e8458b'],
  ['Electricidad', '#ff9ec3'],
  ['Desgaste de la máquina', '#9c2a63'],
  ['Fallos', '#ff9b85'],
];

const pos = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);

export function computeCost(input: CostInput): CostResult {
  const v = Object.fromEntries(
    Object.entries(input).map(([k, x]) => [k, typeof x === 'number' ? pos(x) : x]),
  ) as unknown as CostInput;

  const cant = Math.max(1, Math.floor(v.cant) || 1);
  const purga = v.multi ? 1.2 : 1;
  const fil = v.spoolKg > 0 ? ((v.peso * purga) / (v.spoolKg * 1000)) * v.spoolPrice : 0;
  const luz = (v.watts / 1000) * v.horas * v.kwh;
  const des = v.impVida > 0 ? (v.impPrecio / v.impVida) * v.horas : 0;
  const fal = ((fil + luz + des) * v.fallos) / 100;
  const partes = [fil, luz, des, fal].map((x) => x * cant) as CostResult['partes'];
  const costo = partes.reduce((a, b) => a + b, 0);

  const com = Math.min(v.comision, 95) / 100;
  const base = (costo * (1 + v.margen / 100)) / (1 - com);
  const impuesto = (base * v.impuesto) / 100;

  return {
    cant,
    partes,
    costo,
    comision: base * com,
    impuesto,
    precio: base + impuesto,
    ganancia: base - base * com - costo,
  };
}
