import { describe, expect, it } from 'vitest';
import { parseSvgString, SvgParseError } from '../svgAnalyze';

const CLOSED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10,10 L90,10 L90,90 L10,90 Z" fill="#ff0000" />
</svg>`;

const OPEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10,10 L90,10 L50,90" fill="#00ff00" />
</svg>`;

const COINCIDENT_CLOSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10,10 L90,10 L90,90 L10,90 L10,10" fill="#0000ff" />
</svg>`;

const TEXT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10,10 L90,10 L90,90 L10,90 Z" fill="#ff0000" />
  <text x="10" y="20">Hola</text>
</svg>`;

const TWO_COLORS_STROKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M10,10 L40,10 L40,40 L10,40 Z" fill="none" stroke="#ff0000" />
  <path d="M50,50 L90,50 L90,90 L50,90 Z" fill="none" stroke="#0000ff" />
</svg>`;

const SHAPES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="0" y="0" width="10" height="10" fill="#111111" />
  <circle cx="50" cy="50" r="10" fill="#222222" />
  <polygon points="0,0 10,0 5,10" fill="#333333" />
</svg>`;

describe('parseSvgString', () => {
  it('detecta una forma cerrada con Z', () => {
    const r = parseSvgString(CLOSED_SVG);
    expect(r.hasAnyClosedShape).toBe(true);
    expect(r.hasOpenSubpaths).toBe(false);
    expect(r.widthUnits).toBe(100);
    expect(r.heightUnits).toBe(100);
  });

  it('detecta un trazado abierto (sin Z ni coincidencia de puntos)', () => {
    const r = parseSvgString(OPEN_SVG);
    expect(r.hasOpenSubpaths).toBe(true);
    expect(r.hasAnyClosedShape).toBe(false);
  });

  it('trata como cerrado un trazado sin Z cuyo punto final coincide con el inicial', () => {
    const r = parseSvgString(COINCIDENT_CLOSE_SVG);
    expect(r.hasAnyClosedShape).toBe(true);
    expect(r.hasOpenSubpaths).toBe(false);
  });

  it('cuenta los elementos de texto sin convertir', () => {
    const r = parseSvgString(TEXT_SVG);
    expect(r.textElementCount).toBe(1);
  });

  it('sin texto, el conteo es cero', () => {
    const r = parseSvgString(CLOSED_SVG);
    expect(r.textElementCount).toBe(0);
  });

  it('agrupa por color de stroke cuando no hay relleno (típico de Silhouette Studio)', () => {
    const r = parseSvgString(TWO_COLORS_STROKE_SVG);
    const colors = new Set(r.elements.map((e) => e.colorKey));
    expect(colors).toEqual(new Set(['#ff0000', '#0000ff']));
  });

  it('reconoce rect, circle y polygon como formas siempre cerradas', () => {
    const r = parseSvgString(SHAPES_SVG);
    expect(r.elements).toHaveLength(3);
    expect(r.hasAnyClosedShape).toBe(true);
    expect(r.hasOpenSubpaths).toBe(false);
  });

  it('lanza SvgParseError con contenido no-SVG', () => {
    expect(() => parseSvgString('esto no es xml <<< >>>')).toThrow(SvgParseError);
  });

  it('lanza SvgParseError si la raíz no es <svg>', () => {
    expect(() => parseSvgString('<html><body>hola</body></html>')).toThrow(SvgParseError);
  });
});
