/**
 * Calculadora de costos de impresión 3D (pestaña "Calculadora").
 * Todo se guarda sólo en este navegador (localStorage).
 */
import { computeCost, PARTES, type CostInput, type CostResult } from './lib/costCalc';
import { sanitizeFileName } from './lib/stlExport';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById('calc-' + id) as T;

const ICON: Record<string, string> = {
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  wrench:
    '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  tag: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14.5 8.5l2 2"/>',
};

// [código, símbolo, nombre, decimales, cuánto vale 1 USD aprox.]
type Moneda = [string, string, string, number, number];
const MONEDAS: Moneda[] = [
  ['USD', '$', 'Estados Unidos / Ecuador / El Salvador', 2, 1],
  ['MXN', '$', 'México', 2, 18],
  ['COP', '$', 'Colombia', 0, 4000],
  ['ARS', '$', 'Argentina', 0, 1000],
  ['CLP', '$', 'Chile', 0, 950],
  ['PEN', 'S/', 'Perú', 2, 3.7],
  ['BRL', 'R$', 'Brasil', 2, 5.5],
  ['UYU', '$U', 'Uruguay', 2, 40],
  ['BOB', 'Bs', 'Bolivia', 2, 6.9],
  ['PYG', '₲', 'Paraguay', 0, 7500],
  ['VES', 'Bs.S', 'Venezuela', 2, 40],
  ['DOP', 'RD$', 'República Dominicana', 2, 60],
  ['CRC', '₡', 'Costa Rica', 0, 520],
  ['GTQ', 'Q', 'Guatemala', 2, 7.7],
  ['HNL', 'L', 'Honduras', 2, 25],
  ['NIO', 'C$', 'Nicaragua', 2, 37],
  ['PAB', 'B/.', 'Panamá', 2, 1],
  ['EUR', '€', 'España / Europa', 2, 0.92],
  ['GBP', '£', 'Reino Unido', 2, 0.78],
  ['CAD', 'C$', 'Canadá', 2, 1.37],
  ['CUSTOM', '', 'Otra (personalizada)', 2, 1],
];
const REGION: Record<string, string> = {
  MX: 'MXN', CO: 'COP', AR: 'ARS', CL: 'CLP', PE: 'PEN', BR: 'BRL', UY: 'UYU', BO: 'BOB', PY: 'PYG',
  VE: 'VES', DO: 'DOP', CR: 'CRC', GT: 'GTQ', HN: 'HNL', NI: 'NIO', PA: 'PAB', ES: 'EUR', GB: 'GBP',
  CA: 'CAD', EC: 'USD', SV: 'USD', US: 'USD',
};

type FieldId = Exclude<keyof CostInput, 'multi' | 'accesorios'>;
interface Field {
  id: FieldId;
  l: string;
  u?: string;
  money?: boolean; // valor en USD que se convierte a la moneda elegida
  min: number;
  max: number;
  step?: number;
  def: number;
  typ: [number, number]; // rango típico
  c?: string;
}
interface Seccion {
  t: string;
  s: string;
  ic: string;
  c: string;
  f: Field[];
  toggle?: boolean;
}

const SECCIONES: Seccion[] = [
  { t: 'Material', s: 'Precio de la bobina, su peso y cuánto filamento usa tu pieza.', ic: 'layers', c: '#e8458b', toggle: true, f: [
    { id: 'spoolPrice', l: 'Precio de la bobina', money: true, min: 0, max: 80, def: 20, typ: [18, 25] },
    { id: 'spoolKg', l: 'Peso de la bobina', u: 'kg', min: 0.25, max: 5, step: 0.25, def: 1, typ: [1, 1] },
    { id: 'peso', l: 'Filamento usado', u: 'g', min: 1, max: 500, step: 1, def: 50, typ: [10, 100] },
  ] },
  { t: 'Energía', s: 'Tiempo de impresión, consumo de la máquina y precio de la luz.', ic: 'bolt', c: '#f0709f', f: [
    { id: 'horas', l: 'Tiempo de impresión', u: 'h', min: 0, max: 48, step: 0.25, def: 4, typ: [1, 10] },
    { id: 'watts', l: 'Consumo de la impresora', u: 'W', min: 30, max: 400, step: 5, def: 130, typ: [100, 200] },
    { id: 'kwh', l: 'Precio de la luz', money: true, u: '/kWh', min: 0, max: 0.6, def: 0.16, typ: [0.1, 0.25] },
  ] },
  { t: 'Desgaste de la máquina', s: 'Opcional: reparte lo que costó tu impresora entre sus horas de vida.', ic: 'wrench', c: '#c2407a', f: [
    { id: 'impPrecio', l: 'Costo de tu impresora', money: true, min: 0, max: 2500, def: 350, typ: [250, 600] },
    { id: 'impVida', l: 'Vida útil esperada', u: 'h', min: 500, max: 10000, step: 100, def: 4000, typ: [3000, 5000] },
  ] },
  { t: 'Producción y fallos', s: 'Cuántas copias haces y qué porcentaje sale mal.', ic: 'box', c: '#ff8f7a', f: [
    { id: 'cant', l: 'Cantidad de piezas', u: 'pzs', min: 1, max: 30, step: 1, def: 1, typ: [1, 10] },
    { id: 'fallos', l: 'Margen por fallos', u: '%', min: 0, max: 30, step: 1, def: 5, typ: [5, 10] },
  ] },
  { t: 'Precio de venta', s: 'Cuánto quieres ganar y qué cobra la plataforma donde vendes.', ic: 'tag', c: '#e8458b', f: [
    { id: 'margen', l: 'Tu ganancia deseada', u: '%', min: 0, max: 300, step: 5, def: 60, typ: [40, 100] },
    { id: 'comision', l: 'Comisión de plataforma', u: '%', min: 0, max: 30, step: 1, def: 0, typ: [5, 15] },
    { id: 'impuesto', l: 'Impuestos (IVA, etc.)', u: '%', min: 0, max: 30, step: 1, def: 0, typ: [0, 19] },
  ] },
];
const FIELDS: Field[] = SECCIONES.flatMap((s) => s.f.map((f) => ({ ...f, c: s.c })));

type Atajo = [string, string, Partial<Record<FieldId, number>>];
const TAMANOS: Atajo[] = [
  ['Pequeña', 'llavero, figura mini', { peso: 15, horas: 1.5 }],
  ['Mediana', 'maceta, soporte', { peso: 60, horas: 5 }],
  ['Grande', 'organizador, lámpara', { peso: 180, horas: 14 }],
];
const MATERIALES: Atajo[] = [
  ['PLA', '', { spoolPrice: 20 }],
  ['PETG', '', { spoolPrice: 22 }],
  ['ABS', '', { spoolPrice: 22 }],
  ['TPU', '', { spoolPrice: 30 }],
  ['Silk', '', { spoolPrice: 25 }],
  ['Resina', '', { spoolPrice: 40 }],
];
const IMPRESORAS: Atajo[] = [
  ['Económica', 'Ender 3 · ~120 W', { watts: 120, impPrecio: 250, impVida: 3000 }],
  ['Media', 'Bambu / Prusa · ~100 W', { watts: 100, impPrecio: 450, impVida: 5000 }],
  ['Alta gama', 'Industrial · ~250 W', { watts: 250, impPrecio: 1500, impVida: 8000 }],
];

// Accesorios que se compran aparte y se montan en la pieza.
// precio: en la moneda elegida, por unidad; cant: unidades por pieza.
interface Accesorio {
  nombre: string;
  precio: number;
  cant: number;
}
// [nombre, precio aproximado en USD]
const ACCESORIOS_RAPIDOS: [string, number][] = [
  ['Argolla de llavero', 0.1],
  ['Switch para clicker', 0.3],
  ['Cadena / mosquetón', 0.25],
];
let accesorios: Accesorio[] = [];

const KEY_ESTADO = 'calc3d.estado';
const KEY_HIST = 'calc3d.historial';
const KEY_PERFIL = 'calc3d.perfil';

const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* almacenamiento no disponible: se sigue sin guardar */
    }
  },
};

const nice = (v: number) => (v === 0 ? 0 : Number(Number(v).toPrecision(3)));
const short = (n: number) => (+n.toPrecision(2)).toLocaleString('es', { maximumFractionDigits: 2 });

let rateAct = 1;
let ultimo: CostResult | null = null;
let iniciada = false;

const sel = () => $<HTMLSelectElement>('moneda');
const input = (id: string) => $<HTMLInputElement>(id);

function getRate(): number {
  if (sel().value === 'CUSTOM') return parseFloat(input('cRate').value) || 1;
  return MONEDAS.find((m) => m[0] === sel().value)![4];
}
function mon() {
  if (sel().value === 'CUSTOM') {
    return {
      cod: input('cCod').value,
      sim: input('cSim').value,
      dec: Math.max(0, Math.min(4, +input('cDec').value || 0)),
    };
  }
  const m = MONEDAS.find((x) => x[0] === sel().value)!;
  return { cod: m[0], sim: m[1], dec: m[3] };
}
function fmt(n: number) {
  const m = mon();
  return (
    m.sim +
    (Number.isFinite(n) ? n : 0).toLocaleString('es', {
      minimumFractionDigits: m.dec,
      maximumFractionDigits: m.dec,
    })
  );
}

function buildForm() {
  const sel_ = sel();
  for (const m of MONEDAS) {
    const o = document.createElement('option');
    o.value = m[0];
    o.textContent = m[0] === 'CUSTOM' ? m[2] : `${m[2]} · ${m[0]} (${m[1]})`;
    sel_.appendChild(o);
  }

  const cont = $('secciones');
  for (const s of SECCIONES) {
    const d = document.createElement('div');
    d.className = 'card calc-card';
    d.style.setProperty('--c', s.c);
    d.innerHTML = `<div class="calc-ch"><div class="calc-ico"><svg viewBox="0 0 24 24">${ICON[s.ic]}</svg></div><div><h2>${s.t}</h2><p>${s.s}</p></div></div>
      <div class="calc-fs">${s.f
        .map(
          (f) => `<div class="calc-f"><label for="calc-${f.id}">${f.l}<span class="calc-typ" id="calc-typ_${f.id}"></span></label>
        <div class="calc-box">${f.money ? '<span class="calc-pre" data-sim></span>' : ''}<input type="number" id="calc-${f.id}" min="0" step="any" inputmode="decimal"><span class="calc-suf">${f.u || ''}</span></div>
        <input type="range" id="calc-${f.id}_r" aria-label="${f.l}"></div>`,
        )
        .join('')}</div>
      ${
        s.toggle
          ? `<div class="calc-sw"><div><b>Impresión multicolor (AMS / MMU)</b><small>Suma ~20% de filamento que se desperdicia al cambiar de color</small></div><label class="calc-tg"><input type="checkbox" id="calc-multi" aria-label="Impresión multicolor"><i></i></label></div>`
          : ''
      }`;
    cont.appendChild(d);
  }

  // Accesorios: va antes de "Precio de venta" (la última sección).
  const acc = document.createElement('div');
  acc.className = 'card calc-card';
  acc.style.setProperty('--c', '#cf8b2c');
  acc.innerHTML = `<div class="calc-ch"><div class="calc-ico"><svg viewBox="0 0 24 24">${ICON.key}</svg></div><div><h2>Accesorios</h2><p>Lo que compras aparte y montas en cada pieza: argollas, switches de clicker, cadenas…</p></div></div>
    <div class="calc-chips" id="calc-accRapidos"></div>
    <div id="calc-accLista" class="calc-acc-lista"></div>
    <p class="calc-note" id="calc-accTotal"></p>
    <p class="calc-note">Se suman al costo de cada pieza (no al margen de fallos). Los precios son aproximados: pon lo que te cuestan a ti.</p>`;
  cont.insertBefore(acc, cont.lastElementChild);

  const rapidos = $('accRapidos');
  for (const [nm, usd] of ACCESORIOS_RAPIDOS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'calc-chip';
    b.textContent = `+ ${nm}`;
    b.onclick = () => agregarAccesorio(nm, nice(usd * rateAct));
    rapidos.appendChild(b);
  }
  const otro = document.createElement('button');
  otro.type = 'button';
  otro.className = 'calc-chip';
  otro.textContent = '+ Otro';
  otro.onclick = () => agregarAccesorio('', 0, true);
  rapidos.appendChild(otro);

  chips($('chTam'), TAMANOS);
  chips($('chMat'), MATERIALES);
  chips($('chImp'), IMPRESORAS);
}

function chips(cont: HTMLElement, items: Atajo[]) {
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'calc-chip';
    b.innerHTML = it[1] ? `${it[0]}<small>${it[1]}</small>` : it[0];
    b.onclick = () => {
      [...cont.children].forEach((c) => c.classList.toggle('on', c === b));
      for (const [k, v] of Object.entries(it[2])) setVal(k as FieldId, v!);
      calc();
    };
    cont.appendChild(b);
  }
}

function setRange(f: Field) {
  const r = input(f.id + '_r');
  const k = f.money ? rateAct : 1;
  r.min = String(f.min * k);
  r.max = String(f.max * k);
  r.step = String(f.money ? nice((f.max * k) / 200) : f.step);
  r.style.setProperty('--c', f.c!);
  const t = f.typ;
  $('typ_' + f.id).textContent =
    t[0] === t[1] ? '' : `Típico ${f.money ? short(t[0] * k) : t[0]}–${f.money ? short(t[1] * k) : t[1]}`;
}
function paint(f: Field) {
  const r = input(f.id + '_r');
  const v = parseFloat(input(f.id).value) || 0;
  r.value = String(v);
  const min = parseFloat(r.min);
  const max = parseFloat(r.max);
  r.style.setProperty('--p', Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100)) + '%');
}
function setVal(id: FieldId, v: number) {
  const f = FIELDS.find((x) => x.id === id)!;
  input(id).value = String(f.money ? nice(v * rateAct) : v);
  paint(f);
}
function setSims() {
  const m = mon();
  document.querySelectorAll<HTMLElement>('#tab-calc [data-sim]').forEach((e) => (e.textContent = m.sim || m.cod));
}

// ---- accesorios

const accPorPieza = () => accesorios.reduce((t, a) => t + Math.max(0, a.precio) * Math.max(0, a.cant), 0);

function agregarAccesorio(nombre: string, precio: number, enfocar = false) {
  // Si ya está en la lista, se suma una unidad más por pieza.
  const existente = nombre ? accesorios.find((a) => a.nombre === nombre) : undefined;
  if (existente) existente.cant += 1;
  else accesorios.push({ nombre, precio, cant: 1 });
  renderAccesorios();
  calc();
  if (enfocar) {
    const inputs = document.querySelectorAll<HTMLInputElement>('#calc-accLista .calc-acc-nombre');
    inputs[inputs.length - 1]?.focus();
  }
}

function accInput(cls: string, value: string, label: string, numeric: boolean, onInput: (v: string) => void) {
  const i = document.createElement('input');
  i.className = cls;
  i.value = value;
  i.setAttribute('aria-label', label);
  if (numeric) {
    i.type = 'number';
    i.min = '0';
    i.step = 'any';
    i.inputMode = 'decimal';
  } else {
    i.type = 'text';
    i.maxLength = 60;
    i.placeholder = 'Nombre del accesorio';
  }
  i.addEventListener('input', () => {
    onInput(i.value);
    calc();
  });
  return i;
}

function renderAccesorios() {
  const lista = $('accLista');
  lista.replaceChildren();
  if (!accesorios.length) {
    const v = document.createElement('div');
    v.className = 'calc-vac';
    v.textContent = 'Sin accesorios. Toca un botón de arriba para añadir uno.';
    lista.appendChild(v);
    return;
  }
  const head = document.createElement('div');
  head.className = 'calc-acc-row calc-acc-head';
  for (const t of ['Accesorio', 'Precio c/u', 'Por pieza', '']) {
    const s = document.createElement('span');
    s.textContent = t;
    head.appendChild(s);
  }
  lista.appendChild(head);

  accesorios.forEach((a, idx) => {
    const row = document.createElement('div');
    row.className = 'calc-acc-row';

    const nombreIn = accInput('calc-acc-nombre', a.nombre, 'Nombre del accesorio', false, (v) => (a.nombre = v));

    const precioBox = document.createElement('div');
    precioBox.className = 'calc-box';
    const pre = document.createElement('span');
    pre.className = 'calc-pre';
    pre.dataset.sim = '';
    const m = mon();
    pre.textContent = m.sim || m.cod;
    precioBox.append(
      pre,
      accInput('', String(a.precio), `Precio de ${a.nombre || 'accesorio'}`, true, (v) => (a.precio = parseFloat(v) || 0)),
    );

    const cantBox = document.createElement('div');
    cantBox.className = 'calc-box';
    const cantIn = accInput('', String(a.cant), `Unidades por pieza de ${a.nombre || 'accesorio'}`, true, (v) => (a.cant = parseFloat(v) || 0));
    cantIn.step = '1';
    const suf = document.createElement('span');
    suf.className = 'calc-suf';
    suf.textContent = '/pza';
    cantBox.append(cantIn, suf);

    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'calc-acc-quitar';
    x.textContent = '×';
    x.title = 'Quitar';
    x.setAttribute('aria-label', `Quitar ${a.nombre || 'accesorio'}`);
    x.onclick = () => {
      accesorios.splice(idx, 1);
      renderAccesorios();
      calc();
    };

    row.append(nombreIn, precioBox, cantBox, x);
    lista.appendChild(row);
  });
}

function aplicaMoneda(nuevo: number) {
  const viejo = rateAct;
  rateAct = nuevo;
  for (const a of accesorios) a.precio = nice((a.precio / viejo) * nuevo);
  if (iniciada) renderAccesorios();
  for (const f of FIELDS) {
    if (f.money) {
      const v = parseFloat(input(f.id).value) || 0;
      input(f.id).value = String(nice((v / viejo) * nuevo));
    }
    setRange(f);
    paint(f);
  }
  setSims();
}

const n = (id: FieldId) => parseFloat(input(id).value) || 0;
const nombre = () => input('nombre').value.trim();

function calc() {
  const values = Object.fromEntries(FIELDS.map((f) => [f.id, n(f.id)])) as Record<FieldId, number>;
  const acc = accPorPieza();
  const r = computeCost({ ...values, multi: input('multi').checked, accesorios: acc });
  ultimo = r;

  $('accTotal').textContent = acc
    ? `Accesorios: ${fmt(acc)} por pieza` + (r.cant > 1 ? ` · ${fmt(r.partes[4])} en total (${r.cant} piezas)` : '')
    : '';

  const rNombre = $('rNombre');
  rNombre.textContent = nombre();
  rNombre.classList.toggle('hidden', !nombre());

  $('rPrecio').textContent = $('mPrecio').textContent = fmt(r.precio);
  $('rUnit').textContent =
    r.cant > 1 ? `${fmt(r.precio / r.cant)} por pieza · ${r.cant} piezas` : 'Precio por 1 pieza';
  $('rCosto').textContent = fmt(r.costo);
  $('rGan').textContent = fmt(r.ganancia);

  const rows = $('rows');
  const bar = $('bar');
  rows.replaceChildren();
  bar.replaceChildren();
  PARTES.forEach(([nm, col], i) => {
    if (nm === 'Accesorios' && r.partes[i] === 0) return; // sólo si hay accesorios
    const p = r.costo > 0 ? r.partes[i] / r.costo : 0;
    const row = document.createElement('div');
    row.className = 'calc-row';
    const sw = document.createElement('i');
    sw.style.background = col;
    const name = document.createElement('span');
    name.textContent = nm;
    const pct = document.createElement('span');
    pct.className = 'calc-pct';
    pct.textContent = `${Math.round(p * 100)}%`;
    const val = document.createElement('b');
    val.textContent = fmt(r.partes[i]);
    row.append(sw, name, pct, val);
    rows.appendChild(row);
    if (p > 0) {
      const s = document.createElement('span');
      s.style.cssText = `width:${p * 100}%;background:${col}`;
      bar.appendChild(s);
    }
  });

  const ex: string[] = [];
  if (r.comision > 0) ex.push(`Comisión de plataforma: ${fmt(r.comision)}`);
  if (r.impuesto > 0) ex.push(`Impuestos: ${fmt(r.impuesto)}`);
  $('extra').textContent = ex.join('\n');
  guardarEstado();
}

function valores() {
  return Object.fromEntries(FIELDS.map((f) => [f.id, input(f.id).value]));
}

function guardarEstado() {
  store.set(KEY_ESTADO, {
    nombre: input('nombre').value,
    cur: sel().value,
    rate: rateAct,
    multi: input('multi').checked,
    accesorios,
    cust: { sim: input('cSim').value, cod: input('cCod').value, dec: input('cDec').value, rate: input('cRate').value },
    vals: valores(),
  });
}

function resumen() {
  const u = ultimo!;
  const prod = nombre() ? `Producto: ${nombre()}\n` : '';
  const usados = accesorios.filter((a) => a.precio > 0 && a.cant > 0);
  const detalleAcc = usados.length
    ? '\n' +
      usados
        .map((a) => `  · ${a.nombre || 'Accesorio'}: ${a.cant} × ${fmt(a.precio)} por pieza`)
        .join('\n')
    : '';
  return (
    `Cotización de impresión 3D\n${prod}Cantidad: ${u.cant}\n\n` +
    PARTES.map((p, i) => (p[0] === 'Accesorios' && !u.partes[i] ? '' : `${p[0]}: ${fmt(u.partes[i])}`))
      .filter(Boolean)
      .join('\n') +
    detalleAcc +
    `\n\nCosto total: ${fmt(u.costo)}\nPrecio de venta: ${fmt(u.precio)}\nGanancia neta: ${fmt(u.ganancia)}`
  );
}

interface Cotizacion {
  n?: string; // nombre del producto (las cotizaciones antiguas no lo tienen)
  p: string;
  c: number;
  f: string;
}
function hist() {
  const h = store.get<Cotizacion[]>(KEY_HIST, []);
  const cont = $('hist');
  cont.replaceChildren();
  if (!h.length) {
    const v = document.createElement('div');
    v.className = 'calc-vac';
    v.textContent = 'Aún no guardas cotizaciones.';
    cont.appendChild(v);
  }
  h.forEach((q, i) => {
    const d = document.createElement('div');
    d.className = 'calc-h';
    const nm = document.createElement('div');
    nm.className = 'calc-n';
    nm.textContent = q.n || q.p;
    nm.title = q.n || '';
    const sm = document.createElement('small');
    sm.textContent = `${q.n ? q.p + ' · ' : ''}${q.c} pza · ${q.f}`;
    nm.appendChild(sm);
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.title = 'Eliminar';
    x.setAttribute('aria-label', 'Eliminar cotización');
    x.onclick = () => {
      h.splice(i, 1);
      store.set(KEY_HIST, h);
      hist();
    };
    d.append(nm, x);
    cont.appendChild(d);
  });
}

function toast(t: string) {
  const e = $('toast');
  e.textContent = t;
  e.classList.add('on');
  clearTimeout((toast as unknown as { t?: number }).t);
  (toast as unknown as { t?: number }).t = window.setTimeout(() => e.classList.remove('on'), 2000);
}

function wire() {
  for (const f of FIELDS) {
    input(f.id).addEventListener('input', () => {
      paint(f);
      calc();
    });
    input(f.id + '_r').addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      input(f.id).value = String(f.money ? Number(v.toFixed(2)) : v);
      paint(f);
      calc();
    });
  }
  input('multi').addEventListener('change', calc);
  input('nombre').addEventListener('input', calc);

  sel().onchange = () => {
    aplicaMoneda(getRate());
    $('cust').classList.toggle('on', sel().value === 'CUSTOM');
    calc();
  };
  ['cSim', 'cCod', 'cDec'].forEach((id) =>
    input(id).addEventListener('input', () => {
      setSims();
      calc();
    }),
  );
  input('cRate').addEventListener('change', () => {
    aplicaMoneda(getRate());
    calc();
  });

  $('copiar').onclick = () => {
    (navigator.clipboard ? navigator.clipboard.writeText(resumen()) : Promise.reject()).then(
      () => toast('Resumen copiado'),
      () => toast('No se pudo copiar'),
    );
  };
  $('desc').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([resumen()], { type: 'text/plain' }));
    a.download = nombre()
      ? `cotizacion-${sanitizeFileName(nombre()).replace(/_/g, '-')}.txt`
      : 'cotizacion-3d.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  $('guardar').onclick = () => {
    const h = store.get<Cotizacion[]>(KEY_HIST, []);
    h.unshift({
      n: nombre() || undefined,
      p: fmt(ultimo!.precio),
      c: ultimo!.cant,
      f: new Date().toLocaleDateString('es'),
    });
    store.set(KEY_HIST, h.slice(0, 50));
    hist();
    toast('Cotización guardada');
  };
  $('perfil').onclick = () => {
    store.set(KEY_PERFIL, { rate: rateAct, vals: valores(), multi: input('multi').checked, accesorios });
    toast('Perfil guardado');
  };
  $('reset').onclick = () => {
    const p = store.get<{
      rate: number;
      vals: Record<string, string>;
      multi: boolean;
      accesorios?: Accesorio[];
    } | null>(KEY_PERFIL, null);
    for (const f of FIELDS) {
      if (p && p.vals[f.id] !== undefined) {
        const v = parseFloat(p.vals[f.id]);
        input(f.id).value = String(f.money ? nice((v / p.rate) * rateAct) : v);
      } else {
        input(f.id).value = String(f.money ? nice(f.def * rateAct) : f.def);
      }
      paint(f);
    }
    input('multi').checked = p ? p.multi : false;
    accesorios = (p?.accesorios ?? []).map((a) => ({ ...a, precio: nice((a.precio / p!.rate) * rateAct) }));
    renderAccesorios();
    document.querySelectorAll('#tab-calc .calc-chip.on').forEach((c) => c.classList.remove('on'));
    calc();
    toast(p ? 'Valores de tu perfil' : 'Valores promedio');
  };
}

/** Se llama la primera vez que se abre la pestaña. */
export function initCalculator() {
  if (iniciada) return;
  iniciada = true;
  buildForm();
  wire();

  const s = store.get<{
    nombre?: string;
    accesorios?: Accesorio[];
    cur: string;
    multi: boolean;
    cust?: { sim: string; cod: string; dec: string; rate: string };
    vals?: Record<string, string>;
  } | null>(KEY_ESTADO, null);
  let cur = 'USD';
  if (s && MONEDAS.some((m) => m[0] === s.cur)) cur = s.cur;
  else {
    const r = (navigator.language || '').split('-')[1]?.toUpperCase();
    if (r && REGION[r]) cur = REGION[r];
  }
  sel().value = cur;
  if (s?.nombre) input('nombre').value = s.nombre;
  if (s?.cust) {
    input('cSim').value = s.cust.sim;
    input('cCod').value = s.cust.cod;
    input('cDec').value = s.cust.dec;
    input('cRate').value = s.cust.rate;
  }
  $('cust').classList.toggle('on', cur === 'CUSTOM');
  rateAct = getRate();
  for (const f of FIELDS) {
    setRange(f);
    input(f.id).value =
      s?.vals?.[f.id] !== undefined ? s.vals[f.id] : String(f.money ? nice(f.def * rateAct) : f.def);
    paint(f);
  }
  if (s) input('multi').checked = !!s.multi;
  if (Array.isArray(s?.accesorios)) {
    accesorios = s.accesorios
      .filter((a) => a && typeof a.precio === 'number')
      .map((a) => ({ nombre: String(a.nombre ?? ''), precio: a.precio, cant: Number(a.cant) || 0 }));
  }
  renderAccesorios();
  setSims();
  hist();
  calc();
}
