/**
 * Vercel Serverless Function — LaTeX render proxy.
 * Forwards to the Railway pdflatex renderer service.
 * Uses Node.js runtime (not Edge) for 60s timeout support.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = { maxDuration: 60 }

const RENDERER_URL = 'https://latex-renderer-production.up.railway.app/render'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const code: string = req.body?.code ?? ''
  if (!code) return res.status(400).send('Missing code')

  try {
    const renderRes = await fetch(RENDERER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    if (!renderRes.ok) {
      const msg = await renderRes.text().catch(() => '')
      return res.status(502).send(`Render error: ${msg}`)
    }

    const buf = Buffer.from(await renderRes.arrayBuffer())
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.status(200).send(buf)
  } catch (err) {
    return res.status(502).send(`Proxy error: ${err}`)
  }
}
