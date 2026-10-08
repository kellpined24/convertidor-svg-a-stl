import { describe, expect, it } from 'vitest';
import { computeCost, type CostInput } from '../costCalc';

// Valores por defecto de la calculadora (USD).
const DEF: CostInput = {
  spoolPrice: 20,
  spoolKg: 1,
  peso: 50,
  horas: 4,
  watts: 130,
  kwh: 0.16,
  impPrecio: 350,
  impVida: 4000,
  cant: 1,
  fallos: 5,
  margen: 60,
  comision: 0,
  impuesto: 0,
  multi: false,
};

describe('computeCost', () => {
  it('desglosa filamento, luz, desgaste y fallos', () => {
    const r = computeCost(DEF);
    const [fil, luz, des, fal] = r.partes;
    expect(fil).toBeCloseTo(1, 6); // 50 g de 1 kg a 20
    expect(luz).toBeCloseTo(0.0832, 6); // 0,13 kW × 4 h × 0,16
    expect(des).toBeCloseTo(0.35, 6); // 350 / 4000 × 4 h
    expect(fal).toBeCloseTo((1 + 0.0832 + 0.35) * 0.05, 6);
    expect(r.costo).toBeCloseTo(1.50486, 5);
    expect(r.precio).toBeCloseTo(1.50486 * 1.6, 5);
    expect(r.ganancia).toBeCloseTo(1.50486 * 0.6, 5);
  });

  it('multicolor suma 20 % de filamento', () => {
    expect(computeCost({ ...DEF, multi: true }).partes[0]).toBeCloseTo(1.2, 6);
  });

  it('multiplica por la cantidad de piezas', () => {
    const uno = computeCost(DEF);
    const diez = computeCost({ ...DEF, cant: 10 });
    expect(diez.costo).toBeCloseTo(uno.costo * 10, 6);
    expect(diez.precio).toBeCloseTo(uno.precio * 10, 6);
  });

  it('la comisión no se come la ganancia y el impuesto se suma al final', () => {
    const r = computeCost({ ...DEF, comision: 10, impuesto: 19 });
    const base = (r.costo * 1.6) / 0.9;
    expect(r.comision).toBeCloseTo(base * 0.1, 6);
    expect(r.impuesto).toBeCloseTo(base * 0.19, 6);
    expect(r.precio).toBeCloseTo(base * 1.19, 6);
    expect(r.ganancia).toBeCloseTo(r.costo * 0.6, 6);
  });

  it('tolera campos vacíos o negativos sin dar NaN', () => {
    const r = computeCost({ ...DEF, spoolKg: 0, impVida: 0, peso: -5, cant: 0, horas: NaN });
    expect(r.cant).toBe(1);
    expect(Number.isFinite(r.precio)).toBe(true);
    expect(r.costo).toBe(0);
  });
});
