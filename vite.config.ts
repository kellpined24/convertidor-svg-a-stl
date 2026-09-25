import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

// Sólo para `vite dev`: simula /api/me y /api/login (login siempre con el
// código DEV-DEV) para poder probar la interfaz sin desplegar el backend
// real. No se incluye en `vite build` / producción.
function devApiStub(): Plugin {
  return {
    name: 'dev-api-stub',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/me', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ authenticated: true, label: 'Modo desarrollo' }));
      });
      server.middlewares.use('/api/login', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, label: 'Modo desarrollo' }));
      });
    },
  };
}

export default defineConfig({
  plugins: [devApiStub()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        admin: resolve(root, 'admin.html'),
      },
    },
  },
});
