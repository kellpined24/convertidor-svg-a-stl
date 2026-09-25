import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

const exporter = new STLExporter();

export function geometryToStlBlob(geometry: THREE.BufferGeometry): Blob {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  const arrayBuffer = exporter.parse(mesh, { binary: true }) as unknown as DataView;
  // three's binary STL export returns a DataView; wrap its buffer for the Blob.
  const buffer = (arrayBuffer.buffer as ArrayBuffer).slice(
    arrayBuffer.byteOffset,
    arrayBuffer.byteOffset + arrayBuffer.byteLength,
  );
  return new Blob([buffer], { type: 'model/stl' });
}

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'pieza';
}
