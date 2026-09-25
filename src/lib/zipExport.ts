import JSZip from 'jszip';
import type { PartResult } from './convert';
import { geometryToStlBlob, sanitizeFileName } from './stlExport';

export async function buildPartsZip(parts: PartResult[], baseName: string): Promise<Blob> {
  const zip = new JSZip();
  const usedNames = new Set<string>();

  parts.forEach((part, i) => {
    const blob = geometryToStlBlob(part.geometry);
    let name = `${sanitizeFileName(baseName)}_pieza_${i + 1}_${sanitizeFileName(part.colorKey)}.stl`;
    while (usedNames.has(name)) {
      name = `${sanitizeFileName(baseName)}_pieza_${i + 1}_${sanitizeFileName(part.colorKey)}_${Math.random()
        .toString(36)
        .slice(2, 6)}.stl`;
    }
    usedNames.add(name);
    zip.file(name, blob);
  });

  return zip.generateAsync({ type: 'blob' });
}
