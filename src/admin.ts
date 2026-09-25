import './styles/main.css';

interface CodeRecord {
  itemKey: string;
  label: string;
  active: boolean;
  createdAt: number;
  revokedAt?: number;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const gate = $('gate');
const gateForm = $('admin-gate-form') as HTMLFormElement;
const passwordInput = $('admin-password') as HTMLInputElement;
const gateSubmit = $('admin-gate-submit') as HTMLButtonElement;
const gateError = $('admin-gate-error');
const app = $('app');
const logoutBtn = $('admin-logout-btn');

const newCodeForm = $('new-code-form') as HTMLFormElement;
const newCodeLabel = $('new-code-label') as HTMLInputElement;
const newCodeReveal = $('new-code-reveal');

const codesTbody = $('codes-tbody');
const codesCount = $('codes-count');
const codesError = $('codes-error');

function showGateError(msg: string) {
  gateError.textContent = msg;
  gateError.classList.remove('hidden');
}
function hideGateError() {
  gateError.classList.add('hidden');
}
function showCodesError(msg: string) {
  codesError.textContent = msg;
  codesError.classList.remove('hidden');
}
function hideCodesError() {
  codesError.classList.add('hidden');
}

async function tryLoadCodes(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/codes');
    if (res.status === 401) return false;
    const data = await res.json();
    if (!data.ok) {
      showCodesError(data.error || 'No se pudieron cargar los códigos.');
      return true;
    }
    renderCodes(data.codes);
    return true;
  } catch {
    return false;
  }
}

async function init() {
  const authed = await tryLoadCodes();
  if (authed) {
    gate.classList.add('hidden');
    app.classList.remove('hidden');
  } else {
    gate.classList.remove('hidden');
    app.classList.add('hidden');
  }
}

gateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideGateError();
  gateSubmit.disabled = true;
  gateSubmit.innerHTML = '<span class="spinner"></span> Entrando…';
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value }),
    });
    const data = await res.json();
    if (data.ok) {
      passwordInput.value = '';
      await init();
    } else {
      showGateError(data.error || 'Contraseña incorrecta.');
    }
  } catch {
    showGateError('No se pudo conectar con el servidor.');
  } finally {
    gateSubmit.disabled = false;
    gateSubmit.textContent = 'Entrar';
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  location.reload();
});

newCodeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  newCodeReveal.classList.add('hidden');
  hideCodesError();
  const label = newCodeLabel.value.trim();
  if (!label) return;
  const btn = newCodeForm.querySelector('button')!;
  btn.setAttribute('disabled', 'true');
  try {
    const res = await fetch('/api/admin/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    if (!data.ok) {
      showCodesError(data.error || 'No se pudo generar el código.');
      return;
    }
    newCodeReveal.innerHTML = `Código para <strong>${escapeHtml(label)}</strong>: <strong>${data.plainCode}</strong> — cópialo ahora, no se volverá a mostrar.`;
    newCodeReveal.classList.remove('hidden');
    newCodeLabel.value = '';
    await tryLoadCodes();
  } catch {
    showCodesError('No se pudo conectar con el servidor.');
  } finally {
    btn.removeAttribute('disabled');
  }
});

function renderCodes(codes: CodeRecord[]) {
  hideCodesError();
  codesCount.textContent = String(codes.length);
  codesTbody.innerHTML = '';
  for (const code of codes) {
    const tr = document.createElement('tr');
    const date = new Date(code.createdAt).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' });
    tr.innerHTML = `
      <td>${escapeHtml(code.label)}</td>
      <td><span class="status-pill ${code.active ? 'active' : 'revoked'}">${code.active ? 'Activo' : 'Revocado'}</span></td>
      <td>${date}</td>
      <td class="row-actions">
        ${
          code.active
            ? `<button class="secondary" data-action="revoke" data-key="${code.itemKey}">Revocar</button>`
            : `<button class="secondary" data-action="reactivate" data-key="${code.itemKey}">Reactivar</button>`
        }
        <button class="secondary" data-action="replace" data-key="${code.itemKey}">Reemplazar</button>
        <button class="secondary" data-action="delete" data-key="${code.itemKey}">Eliminar</button>
      </td>
    `;
    codesTbody.appendChild(tr);
  }
}

codesTbody.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const itemKey = btn.dataset.key;
  if (!action || !itemKey) return;

  if (action === 'delete') {
    if (!confirm('¿Eliminar este código definitivamente? No se puede deshacer.')) return;
  }
  if (action === 'revoke') {
    if (!confirm('¿Revocar este código? La sesión abierta de la alumna dejará de funcionar de inmediato.')) return;
  }

  hideCodesError();
  btn.setAttribute('disabled', 'true');
  try {
    if (action === 'revoke' || action === 'reactivate') {
      const res = await fetch('/api/admin/codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey, action }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    } else if (action === 'replace') {
      const res = await fetch('/api/admin/codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey, action: 'replace' }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      newCodeReveal.innerHTML = `Nuevo código para <strong>${escapeHtml(data.record.label)}</strong>: <strong>${data.plainCode}</strong> — cópialo ahora, no se volverá a mostrar. El código anterior quedó revocado.`;
      newCodeReveal.classList.remove('hidden');
    } else if (action === 'delete') {
      const res = await fetch('/api/admin/codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    }
    await tryLoadCodes();
  } catch (err) {
    showCodesError(err instanceof Error ? err.message : 'Ocurrió un error.');
  } finally {
    btn.removeAttribute('disabled');
  }
});

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

init();
