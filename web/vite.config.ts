import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// Where the static demo is published. GitHub Pages serves it under /<repo>/demo/, so it is the one
// build NOT mounted at a site root — both the asset base and the router's mount point move. A fork
// with a different repo name (or a custom domain at the root) edits this one line.
const DEMO_BASE = '/Alayra-Nexus/demo/';

// Keyed off Vite's own `mode` rather than a Node environment variable. `process` is a Node global,
// and this file sits inside tsconfig's `include` while `types` is pinned to vitest + jest-dom with
// no "node" — so `process.env` here typechecks locally (TypeScript walks up and finds @types/node
// in the ROOT project's node_modules) and fails in CI, which installs only web/. Using `mode` keeps
// the config free of Node globals; VITE_DEMO reaches the client from .env.demo.
export default defineConfig(({ mode }) => {
  const DEMO = mode === 'demo';

  return {
    // The dashboard builds to static assets the gateway serves as-is (no SSR), so the single
    // self-hostable container is unchanged. `base: '/'` makes asset URLs absolute (/assets/…): the
    // gateway always mounts the dashboard at the site root, and a deep-link refresh (/teams,
    // /nexus …) is answered with index.html by the SPA fallback, so assets must resolve from the
    // root regardless of the route depth the browser happens to have loaded first — a relative base
    // would break them there.
    base: DEMO ? DEMO_BASE : '/',
    plugins: [preact()],

    // Dev only: the built app is served by the gateway itself, so /admin is same-origin in
    // production. During `vite dev` it runs on its own port, so proxy the admin API to the local
    // gateway (PORT 3000). Never used in the static build.
    server: {
      proxy: {
        '/admin':  { target: 'http://localhost:3000', changeOrigin: true },
        // The LIVE pill polls /health (7.13b). Without this entry vite's SPA fallback answers the
        // probe itself with index.html and a 200, and the pill would glow green in dev with no
        // gateway running at all.
        '/health': { target: 'http://localhost:3000', changeOrigin: true },
      },
    },

    build: {
      // The demo lands in the repo's docs/demo so GitHub Pages can publish it from the default
      // branch without a second deployment mechanism; the gateway's own bundle still goes to
      // web/dist.
      outDir: DEMO ? '../docs/demo' : 'dist',
      emptyOutDir: true,
      sourcemap: false,
    },

    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/tests/setup.ts'],
      // CSS Modules are not needed for behaviour tests (queries use roles/text), and skipping
      // their transform keeps the suite fast.
      css: false,
    },
  };
});
