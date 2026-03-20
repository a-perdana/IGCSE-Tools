import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import type { Plugin } from 'vite';

const RAILWAY_URL = 'https://latex-renderer-production.up.railway.app/render'

/**
 * Dev-only proxy: intercepts POST /api/latex and forwards to Railway pdflatex renderer.
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

            const renderRes = await fetch(RAILWAY_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code }),
            })
            if (!renderRes.ok) {
              const msg = await renderRes.text().catch(() => '')
              res.writeHead(502); res.end(`Render error: ${msg}`); return
            }
            const buf = Buffer.from(await renderRes.arrayBuffer())
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
