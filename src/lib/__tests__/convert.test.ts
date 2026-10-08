import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { convertSvgToStl } from '../convert';
import { geometryToStlBlob } from '../stlExport';

// Como exporta Silhouette Studio: el viewBox es la página completa y el
// dibujo ocupa sólo una parte (aquí 100×50 dentro de 500×500).
const SMALL_DRAWING_ON_BIG_PAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <path d="M200,200 L300,200 L300,250 L200,250 Z" fill="#051406" />
  <path d="M220,210 L280,210 L280,240 L220,240 Z" fill="#f7ef29" />
</svg>`;

function sizeOf(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const b = geometry.boundingBox!;
  return { x: b.max.x - b.min.x, y: b.max.y - b.min.y, z: b.max.z - b.min.z };
}

describe('convertSvgToStl', () => {
  it('escala según el ancho del dibujo, no del lienzo', () => {
    const r = convertSvgToStl(SMALL_DRAWING_ON_BIG_PAGE, 70, 2);
    expect(r.modelSizeMM.x).toBeCloseTo(70, 3);
    expect(r.modelSizeMM.y).toBeCloseTo(35, 3);
    expect(r.modelSizeMM.z).toBeCloseTo(2, 3);
    expect(r.measurements.heightMM).toBeCloseTo(35, 3);
    expect(r.parts).toHaveLength(2);
  });

  it('el STL descargado conserva las medidas pedidas', async () => {
    const r = convertSvgToStl(SMALL_DRAWING_ON_BIG_PAGE, 70, 2);
    const buffer = await geometryToStlBlob(r.fullGeometry).arrayBuffer();
    const size = sizeOf(new STLLoader().parse(buffer));
    expect(size.x).toBeCloseTo(70, 2);
    expect(size.y).toBeCloseTo(35, 2);
    expect(size.z).toBeCloseTo(2, 2);
  });

  it('las piezas separadas mantienen su posición y escala relativas', async () => {
    const r = convertSvgToStl(SMALL_DRAWING_ON_BIG_PAGE, 70, 2);
    const inner = r.parts.find((p) => p.colorKey === '#f7ef29')!;
    const buffer = await geometryToStlBlob(inner.geometry).arrayBuffer();
    const size = sizeOf(new STLLoader().parse(buffer));
    // 60×30 unidades de un dibujo de 100 de ancho → 42×21 mm
    expect(size.x).toBeCloseTo(42, 2);
    expect(size.y).toBeCloseTo(21, 2);
  });
});
