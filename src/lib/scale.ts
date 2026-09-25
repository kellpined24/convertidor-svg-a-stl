/**
 * Cálculos puros de escala para el conversor SVG → STL.
 * Sin DOM, sin three.js — fáciles de probar.
 */

export interface MeasurementInput {
  targetWidthMM: number;
  thicknessMM: number;
  svgWidthUnits: number;
  svgHeightUnits: number;
}

export interface MeasurementResult {
  scale: number; // multiplica unidades SVG -> mm
  widthMM: number;
  heightMM: number;
  thicknessMM: number;
}

export class InvalidMeasurementError extends Error {}

const MIN_MM = 1;
const MAX_MM = 1000;
const MIN_THICKNESS_MM = 0.2;
const MAX_THICKNESS_MM = 50;

export function computeMeasurements(input: MeasurementInput): MeasurementResult {
  const { targetWidthMM, thicknessMM, svgWidthUnits, svgHeightUnits } = input;

  if (!Number.isFinite(targetWidthMM) || targetWidthMM <= 0) {
    throw new InvalidMeasurementError('El ancho debe ser un número mayor que 0.');
  }
  if (targetWidthMM < MIN_MM || targetWidthMM > MAX_MM) {
    throw new InvalidMeasurementError(`El ancho debe estar entre ${MIN_MM} mm y ${MAX_MM} mm.`);
  }
  if (!Number.isFinite(thicknessMM) || thicknessMM <= 0) {
    throw new InvalidMeasurementError('El grosor debe ser un número mayor que 0.');
  }
  if (thicknessMM < MIN_THICKNESS_MM || thicknessMM > MAX_THICKNESS_MM) {
    throw new InvalidMeasurementError(
      `El grosor debe estar entre ${MIN_THICKNESS_MM} mm y ${MAX_THICKNESS_MM} mm.`,
    );
  }
  if (!Number.isFinite(svgWidthUnits) || svgWidthUnits <= 0) {
    throw new InvalidMeasurementError('No se pudo determinar el ancho del SVG.');
  }
  if (!Number.isFinite(svgHeightUnits) || svgHeightUnits <= 0) {
    throw new InvalidMeasurementError('No se pudo determinar el alto del SVG.');
  }

  const scale = targetWidthMM / svgWidthUnits;
  const heightMM = svgHeightUnits * scale;

  return {
    scale,
    widthMM: targetWidthMM,
    heightMM,
    thicknessMM,
  };
}
