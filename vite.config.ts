import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import type { Plugin } from 'vite';

/**
 * Dev-only proxy: intercepts POST /api/latex and forwards to latex.codecogs.com.
 * In production this is handled by the Vercel Edge Function at api/latex.ts.
 */
function latexDevProxy(): Plugin {
  return {
    name: 'latex-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/latex', (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' })
          res.end()
          return
        }
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }

        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', async () => {
          try {
            const { code } = JSON.parse(Buffer.concat(chunks).toString()) as { code?: string }
            if (!code) { res.writeHead(400); res.end('Missing code'); return }

            const codecogsRes = await fetch('https://latex.codecogs.com/png.latex', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'igcse-tools/1.0',
              },
              body: `latex=${encodeURIComponent(code)}`,
            })

            if (!codecogsRes.ok) {
              res.writeHead(502); res.end(`Codecogs error: HTTP ${codecogsRes.status}`); return
            }

            const buf = Buffer.from(await codecogsRes.arrayBuffer())
            res.writeHead(200, {
              'Content-Type': 'image/png',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'public, max-age=86400',
            })
            res.end(buf)
          } catch (err) {
            res.writeHead(500); res.end(String(err))
          }
        })
      })
    },
  }
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), latexDevProxy()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
    test: {
      environment: 'jsdom',
    },
  };
});
