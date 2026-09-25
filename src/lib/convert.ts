import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { parseSvgString, SvgParseError } from './svgAnalyze';
import { computeMeasurements, type MeasurementResult } from './scale';

export class ConversionError extends Error {}

export interface PartResult {
  colorKey: string;
  color: THREE.Color;
  geometry: THREE.BufferGeometry;
}

export interface ConversionResult {
  parts: PartResult[];
  fullGeometry: THREE.BufferGeometry;
  measurements: MeasurementResult;
  /** Tamaño real del modelo ya generado (mm), medido sobre la geometría final. */
  modelSizeMM: { x: number; y: number; z: number };
}

/** Voltea el eje Y de una geometría y corrige el sentido de las caras (winding) para que las normales queden hacia afuera. */
function mirrorYInPlace(geometry: THREE.BufferGeometry, scaleXY: number): THREE.BufferGeometry {
  geometry.scale(scaleXY, -scaleXY, 1);
  const index = geometry.getIndex();
  if (index) {
    const arr = index.array as Uint32Array | Uint16Array;
    for (let i = 0; i < arr.length; i += 3) {
      const tmp = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = tmp;
    }
    index.needsUpdate = true;
  }
  geometry.computeVertexNormals();
  return geometry;
}

interface SvgPathStyle {
  fill?: string;
  stroke?: string;
}

function styleColorKey(style: SvgPathStyle | undefined): string {
  const usable = (c?: string) => c && c !== 'none' && c !== 'transparent';
  const fill = style?.fill;
  const stroke = style?.stroke;
  if (usable(fill)) return fill!.trim().toLowerCase();
  if (usable(stroke)) return stroke!.trim().toLowerCase();
  return '#000000';
}

export function validateSvgOrThrow(svgText: string): void {
  let analysis;
  try {
    analysis = parseSvgString(svgText);
  } catch (err) {
    if (err instanceof SvgParseError) {
      throw new ConversionError(err.message);
    }
    throw new ConversionError('No se pudo leer el archivo. Verifica que sea un SVG válido.');
  }

  if (analysis.textElementCount > 0) {
    throw new ConversionError(
      `El SVG tiene ${analysis.textElementCount} elemento(s) de texto sin convertir a trazado. ` +
        'En Silhouette Studio, selecciona el texto y usa "Convertir en trazado de corte" (o similar) antes de exportar como SVG.',
    );
  }

  if (!analysis.hasAnyClosedShape) {
    throw new ConversionError(
      'El SVG no contiene ninguna forma cerrada. Revisa que los trazados terminen en el mismo punto donde empiezan (o usa la opción "Cerrar trazado" / "Soldar" en Silhouette Studio).',
    );
  }

  if (analysis.hasOpenSubpaths) {
    throw new ConversionError(
      'Algunas líneas del SVG no forman una figura cerrada (quedan trazados abiertos). ' +
        'Para convertir a 3D, todas las formas deben estar cerradas. Revisa el diseño en Silhouette Studio y cierra o suelda los trazados sueltos.',
    );
  }
}

export function convertSvgToStl(
  svgText: string,
  targetWidthMM: number,
  thicknessMM: number,
): ConversionResult {
  validateSvgOrThrow(svgText);

  const analysis = parseSvgString(svgText);
  const measurements = computeMeasurements({
    targetWidthMM,
    thicknessMM,
    svgWidthUnits: analysis.widthUnits,
    svgHeightUnits: analysis.heightUnits,
  });

  const loader = new SVGLoader();
  const result = loader.parse(svgText);

  type RawPart = { colorKey: string; geometries: THREE.BufferGeometry[] };
  const byColor = new Map<string, RawPart>();

  for (const path of result.paths) {
    const shapes = path.toShapes();
    if (shapes.length === 0) continue;
    const colorKey = styleColorKey(path.userData?.style as SvgPathStyle | undefined);

    for (const shape of shapes) {
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: measurements.thicknessMM,
        bevelEnabled: false,
        curveSegments: 24,
      });
      mirrorYInPlace(geometry, measurements.scale);

      if (!byColor.has(colorKey)) byColor.set(colorKey, { colorKey, geometries: [] });
      byColor.get(colorKey)!.geometries.push(geometry);
    }
  }

  if (byColor.size === 0) {
    throw new ConversionError('No se pudo generar ninguna pieza a partir de este SVG.');
  }

  const rawParts: PartResult[] = [];
  for (const { colorKey, geometries } of byColor.values()) {
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    rawParts.push({ colorKey, color: new THREE.Color(colorKey), geometry: merged! });
  }

  // Centra el modelo completo sobre el origen (X,Y) manteniendo la posición
  // relativa entre piezas, y apoya la base en Z=0.
  const allGeoms = rawParts.map((p) => p.geometry);
  const combinedForBounds = mergeGeometries(
    allGeoms.map((g) => g.clone()),
    false,
  )!;
  combinedForBounds.computeBoundingBox();
  const bbox = combinedForBounds.boundingBox!;
  const offsetX = -(bbox.min.x + bbox.max.x) / 2;
  const offsetY = -(bbox.min.y + bbox.max.y) / 2;
  const offsetZ = -bbox.min.z;

  for (const g of allGeoms) {
    g.translate(offsetX, offsetY, offsetZ);
  }

  const fullGeometry = mergeGeometries(
    allGeoms.map((g) => g.clone()),
    false,
  )!;
  fullGeometry.computeBoundingBox();
  const finalBox = fullGeometry.boundingBox!;
  const modelSizeMM = {
    x: finalBox.max.x - finalBox.min.x,
    y: finalBox.max.y - finalBox.min.y,
    z: finalBox.max.z - finalBox.min.z,
  };

  return { parts: rawParts, fullGeometry, measurements, modelSizeMM };
}
