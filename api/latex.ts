/**
 * Vercel Edge Function — LaTeX render proxy.
 * Forwards to the Railway pdflatex renderer service.
 */
export const config = { runtime: 'edge' }

const RENDERER_URL = 'https://latex-renderer-production.up.railway.app/render'

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let code: string
  try {
    const body = await req.json() as { code?: string }
    code = body.code ?? ''
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }
  if (!code) return new Response('Missing code', { status: 400 })

  const res = await fetch(RENDERER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    return new Response(`Render error: ${msg}`, { status: 502 })
  }

  const buf = await res.arrayBuffer()
  return new Response(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
