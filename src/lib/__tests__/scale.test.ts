import { describe, expect, it } from 'vitest';
import { computeMeasurements, InvalidMeasurementError } from '../scale';

describe('computeMeasurements', () => {
  it('calcula el alto proporcional al ancho pedido', () => {
    const r = computeMeasurements({
      targetWidthMM: 100,
      thicknessMM: 2,
      svgWidthUnits: 200,
      svgHeightUnits: 50,
    });
    expect(r.scale).toBeCloseTo(0.5);
    expect(r.widthMM).toBe(100);
    expect(r.heightMM).toBeCloseTo(25);
    expect(r.thicknessMM).toBe(2);
  });

  it('mantiene la proporción cuadrada', () => {
    const r = computeMeasurements({
      targetWidthMM: 50,
      thicknessMM: 3,
      svgWidthUnits: 10,
      svgHeightUnits: 10,
    });
    expect(r.heightMM).toBeCloseTo(50);
  });

  it('rechaza ancho negativo o cero', () => {
    expect(() =>
      computeMeasurements({ targetWidthMM: 0, thicknessMM: 2, svgWidthUnits: 10, svgHeightUnits: 10 }),
    ).toThrow(InvalidMeasurementError);
    expect(() =>
      computeMeasurements({ targetWidthMM: -5, thicknessMM: 2, svgWidthUnits: 10, svgHeightUnits: 10 }),
    ).toThrow(InvalidMeasurementError);
  });

  it('rechaza ancho fuera de rango razonable', () => {
    expect(() =>
      computeMeasurements({ targetWidthMM: 5000, thicknessMM: 2, svgWidthUnits: 10, svgHeightUnits: 10 }),
    ).toThrow(InvalidMeasurementError);
  });

  it('rechaza grosor inválido', () => {
    expect(() =>
      computeMeasurements({ targetWidthMM: 50, thicknessMM: 0, svgWidthUnits: 10, svgHeightUnits: 10 }),
    ).toThrow(InvalidMeasurementError);
    expect(() =>
      computeMeasurements({ targetWidthMM: 50, thicknessMM: 100, svgWidthUnits: 10, svgHeightUnits: 10 }),
    ).toThrow(InvalidMeasurementError);
  });

  it('rechaza NaN', () => {
    expect(() =>
      computeMeasurements({ targetWidthMM: NaN, thicknessMM: 2, svgWidthUnits: 10, svgHeightUnits: 10 }),
    ).toThrow(InvalidMeasurementError);
  });

  it('rechaza cuando no se puede leer el tamaño del SVG', () => {
    expect(() =>
      computeMeasurements({ targetWidthMM: 50, thicknessMM: 2, svgWidthUnits: 0, svgHeightUnits: 10 }),
    ).toThrow(InvalidMeasurementError);
  });
});
