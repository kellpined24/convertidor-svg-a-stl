/**
 * Análisis del SVG antes de convertir: detecta problemas comunes
 * (texto sin convertir, trazados abiertos, archivo inválido) y
 * agrupa los elementos <path>/<polygon>/<rect>/<circle>/<ellipse>
 * por color para poder separarlos en piezas.
 *
 * Usa sólo DOMParser, así que corre igual en el navegador y en tests (jsdom).
 */

export interface SubpathClosure {
  closed: boolean;
  pointCount: number;
}

export interface AnalyzedElement {
  node: Element;
  tag: string;
  colorKey: string;
  subpaths: SubpathClosure[];
}

export interface SvgAnalysis {
  doc: Document;
  svgEl: SVGSVGElement;
  widthUnits: number;
  heightUnits: number;
  elements: AnalyzedElement[];
  textElementCount: number;
  hasAnyClosedShape: boolean;
  hasOpenSubpaths: boolean;
}

export class SvgParseError extends Error {}

const CLOSURE_EPSILON = 1e-3;
const SHAPE_TAGS = new Set(['path', 'polygon', 'rect', 'circle', 'ellipse']);

/** Divide el atributo "d" de un <path> en sub-trazados M...Z / M... */
function splitPathData(d: string): string[] {
  const segments: string[] = [];
  let current = '';
  const commands = d.match(/[Mm][^Mm]*/g); // cada sub-trazado empieza con M/m
  if (!commands) return [];
  for (const seg of commands) {
    current = seg.trim();
    if (current) segments.push(current);
  }
  return segments;
}

function parseSubpathPoints(segment: string): { first: [number, number]; last: [number, number] } | null {
  // Extrae todos los números del segmento; asumimos pares x,y consecutivos
  // (suficiente para decidir apertura/cierre; curvas se resuelven por su
  // último par de coordenadas, que es lo que importa para el cierre).
  const nums = segment
    .replace(/[A-Za-z]/g, ' ')
    .replace(/,/g, ' ')
    .replace(/-/g, ' -')
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  if (nums.length < 2) return null;
  const first: [number, number] = [nums[0], nums[1]];
  const last: [number, number] = [nums[nums.length - 2], nums[nums.length - 1]];
  return { first, last };
}

function subpathClosure(segment: string): SubpathClosure {
  const trimmed = segment.trim();
  const explicitClose = /[Zz]\s*$/.test(trimmed);
  const points = parseSubpathPoints(trimmed.replace(/[Zz]\s*$/, ''));
  if (!points) return { closed: explicitClose, pointCount: 0 };
  const dx = points.first[0] - points.last[0];
  const dy = points.first[1] - points.last[1];
  const coincident = Math.sqrt(dx * dx + dy * dy) < CLOSURE_EPSILON;
  return { closed: explicitClose || coincident, pointCount: 2 };
}

function analyzePathElement(el: SVGPathElement): SubpathClosure[] {
  const d = el.getAttribute('d') || '';
  const segments = splitPathData(d);
  if (segments.length === 0) return [];
  return segments.map(subpathClosure);
}

function colorFromStyleString(style: string | null): { fill?: string; stroke?: string } {
  if (!style) return {};
  const out: { fill?: string; stroke?: string } = {};
  for (const decl of style.split(';')) {
    const [prop, value] = decl.split(':').map((s) => s?.trim());
    if (prop === 'fill' && value) out.fill = value;
    if (prop === 'stroke' && value) out.stroke = value;
  }
  return out;
}

/**
 * Determina el "color" que identifica una pieza: usa el relleno (fill) si
 * existe y no es "none"; si no, usa el color del trazo (stroke), que es lo
 * típico en SVG exportados por Silhouette Studio (líneas de corte sin
 * relleno). Recorre ancestros para heredar color cuando no está definido
 * directamente en el elemento.
 */
function colorKeyFor(el: Element): string {
  let node: Element | null = el;
  let fill: string | undefined;
  let stroke: string | undefined;

  while (node && (!fill || !stroke)) {
    const inline = colorFromStyleString(node.getAttribute('style'));
    if (!fill) fill = inline.fill ?? node.getAttribute('fill') ?? undefined;
    if (!stroke) stroke = inline.stroke ?? node.getAttribute('stroke') ?? undefined;
    node = node.parentElement;
  }

  const usable = (c?: string) => c && c !== 'none' && c !== 'transparent';
  if (usable(fill)) return normalizeColor(fill!);
  if (usable(stroke)) return normalizeColor(stroke!);
  return '#000000';
}

function normalizeColor(c: string): string {
  return c.trim().toLowerCase();
}

export function parseSvgString(svgText: string): SvgAnalysis {
  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(svgText, 'image/svg+xml');
  } catch {
    throw new SvgParseError('No se pudo leer el archivo como SVG.');
  }

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new SvgParseError('El archivo no es un SVG válido o está dañado.');
  }

  const svgEl = doc.documentElement as unknown as SVGSVGElement;
  if (!svgEl || svgEl.tagName.toLowerCase() !== 'svg') {
    throw new SvgParseError('El archivo no contiene un elemento <svg> raíz.');
  }

  const { widthUnits, heightUnits } = readSvgDimensions(svgEl);

  const textElementCount = doc.querySelectorAll('text, tspan').length;

  const elements: AnalyzedElement[] = [];
  let hasAnyClosedShape = false;
  let hasOpenSubpaths = false;

  for (const tag of SHAPE_TAGS) {
    doc.querySelectorAll(tag).forEach((node) => {
      const colorKey = colorKeyFor(node);
      let subpaths: SubpathClosure[];
      if (tag === 'path') {
        subpaths = analyzePathElement(node as SVGPathElement);
      } else if (tag === 'polygon' || tag === 'rect' || tag === 'circle' || tag === 'ellipse') {
        // Estas formas son siempre cerradas por definición SVG.
        subpaths = [{ closed: true, pointCount: 2 }];
      } else {
        subpaths = [];
      }
      for (const s of subpaths) {
        if (s.closed) hasAnyClosedShape = true;
        else hasOpenSubpaths = true;
      }
      if (subpaths.length > 0) {
        elements.push({ node, tag, colorKey, subpaths });
      }
    });
  }

  return {
    doc,
    svgEl,
    widthUnits,
    heightUnits,
    elements,
    textElementCount,
    hasAnyClosedShape,
    hasOpenSubpaths,
  };
}

function readSvgDimensions(svgEl: SVGSVGElement): { widthUnits: number; heightUnits: number } {
  const viewBox = svgEl.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      return { widthUnits: parts[2], heightUnits: parts[3] };
    }
  }
  const w = parseFloat(svgEl.getAttribute('width') || '');
  const h = parseFloat(svgEl.getAttribute('height') || '');
  return { widthUnits: w || 0, heightUnits: h || 0 };
}
