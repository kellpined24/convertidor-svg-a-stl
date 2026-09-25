import './styles/main.css';
import { convertSvgToStl, ConversionError, type ConversionResult } from './lib/convert';
import { InvalidMeasurementError } from './lib/scale';
import { Preview3D } from './lib/preview3d';
import { geometryToStlBlob, sanitizeFileName } from './lib/stlExport';
import { buildPartsZip } from './lib/zipExport';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const gate = $('gate');
const gateForm = $('gate-form') as HTMLFormElement;
const gateCode = $('gate-code') as HTMLInputElement;
const gateSubmit = $('gate-submit') as HTMLButtonElement;
const gateError = $('gate-error');
const app = $('app');
const sessionLabel = $('session-label');
const logoutBtn = $('logout-btn');

const dropzone = $('dropzone');
const fileInput = $('file-input') as HTMLInputElement;
const fileChosen = $('file-chosen');
const widthInput = $('width-input') as HTMLInputElement;
const thicknessInput = $('thickness-input') as HTMLInputElement;
const convertBtn = $('convert-btn') as HTMLButtonElement;
const convertError = $('convert-error');
const resultCard = $('result-card');
const viewer = $('viewer');
const partsSummary = $('parts-summary');
const measurementsSummary = $('measurements-summary');
const downloadFullBtn = $('download-full-btn') as HTMLButtonElement;
const downloadZipBtn = $('download-zip-btn') as HTMLButtonElement;

let svgText: string | null = null;
let fileBaseName = 'diseno';
let lastResult: ConversionResult | null = null;
let preview: Preview3D | null = null;

function showGateError(msg: string) {
  gateError.textContent = msg;
  gateError.classList.remove('hidden');
}
function hideGateError() {
  gateError.classList.add('hidden');
}

async function checkSession(): Promise<void> {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (data.authenticated) {
      showApp(data.label);
    } else {
      showGate();
    }
  } catch {
    showGate();
  }
}

function showApp(label: string) {
  gate.classList.add('hidden');
  app.classList.remove('hidden');
  sessionLabel.textContent = label ? `👋 ${label}` : '';
  if (!preview) preview = new Preview3D(viewer);
}

function showGate() {
  app.classList.add('hidden');
  gate.classList.remove('hidden');
}

gateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideGateError();
  const code = gateCode.value.trim();
  if (!code) return;
  gateSubmit.disabled = true;
  gateSubmit.innerHTML = '<span class="spinner"></span> Verificando…';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (data.ok) {
      showApp(data.label);
    } else {
      showGateError(data.error || 'Código inválido.');
    }
  } catch {
    showGateError('No se pudo conectar con el servidor. Intenta de nuevo.');
  } finally {
    gateSubmit.disabled = false;
    gateSubmit.textContent = 'Entrar';
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.reload();
});

// --- Carga de archivo ---

function handleFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
    showConvertError('El archivo debe ser un .svg exportado desde Silhouette Studio.');
    return;
  }
  fileBaseName = file.name.replace(/\.svg$/i, '');
  const reader = new FileReader();
  reader.onload = () => {
    svgText = String(reader.result);
    fileChosen.textContent = `✔ ${file.name}`;
    fileChosen.classList.remove('hidden');
    hideConvertError();
  };
  reader.onerror = () => {
    showConvertError('No se pudo leer el archivo. ¿Es un SVG válido?');
  };
  reader.readAsText(file);
}

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) handleFile(fileInput.files[0]);
});
['dragover', 'dragenter'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  }),
);
['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  }),
);
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

function showConvertError(msg: string) {
  convertError.textContent = msg;
  convertError.classList.remove('hidden');
}
function hideConvertError() {
  convertError.classList.add('hidden');
}

convertBtn.addEventListener('click', () => {
  hideConvertError();
  if (!svgText) {
    showConvertError('Primero sube un archivo SVG.');
    return;
  }
  const width = parseFloat(widthInput.value);
  const thickness = parseFloat(thicknessInput.value);

  convertBtn.disabled = true;
  convertBtn.innerHTML = '<span class="spinner"></span> Convirtiendo…';

  // Se deja respirar al hilo principal para que se vea el estado "Convirtiendo…"
  setTimeout(() => {
    try {
      const result = convertSvgToStl(svgText!, width, thickness);
      lastResult = result;
      renderResult(result);
    } catch (err) {
      if (err instanceof ConversionError || err instanceof InvalidMeasurementError) {
        showConvertError(err.message);
      } else {
        showConvertError('Ocurrió un error inesperado al convertir el archivo.');
        console.error(err);
      }
      resultCard.classList.add('hidden');
    } finally {
      convertBtn.disabled = false;
      convertBtn.textContent = 'Convertir a 3D';
    }
  }, 30);
});

function renderResult(result: ConversionResult) {
  resultCard.classList.remove('hidden');
  preview?.showConversion(result);

  partsSummary.innerHTML = '';
  result.parts.forEach((part, i) => {
    const row = document.createElement('div');
    row.className = 'part-row';
    row.innerHTML = `<span class="swatch" style="background:${part.colorKey}"></span> Pieza ${i + 1} · ${part.colorKey}`;
    partsSummary.appendChild(row);
  });

  const m = result.measurements;
  measurementsSummary.textContent = `${m.widthMM.toFixed(1)} × ${m.heightMM.toFixed(1)} × ${m.thicknessMM.toFixed(1)} mm · ${result.parts.length} pieza(s)/color(es)`;
}

downloadFullBtn.addEventListener('click', () => {
  if (!lastResult) return;
  const blob = geometryToStlBlob(lastResult.fullGeometry);
  triggerDownload(blob, `${sanitizeFileName(fileBaseName)}_completo.stl`);
});

downloadZipBtn.addEventListener('click', async () => {
  if (!lastResult) return;
  downloadZipBtn.disabled = true;
  downloadZipBtn.innerHTML = '<span class="spinner"></span> Preparando ZIP…';
  try {
    const blob = await buildPartsZip(lastResult.parts, fileBaseName);
    triggerDownload(blob, `${sanitizeFileName(fileBaseName)}_piezas.zip`);
  } finally {
    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = '⬇️ Descargar ZIP por piezas/colores';
  }
});

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

checkSession();
