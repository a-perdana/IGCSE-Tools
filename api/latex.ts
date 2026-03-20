/**
 * Vercel Edge Function — Codecogs LaTeX proxy.
 * Accepts POST { code: string } — a full \documentclass standalone document.
 * Forwards to latex.codecogs.com which supports full LaTeX + TikZ.
 * Returns the PNG image directly (proxied to avoid CORS).
 */
export const config = { runtime: 'edge' }

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
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let code: string
  try {
    const body = await req.json() as { code?: string }
    code = body.code ?? ''
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  if (!code) return new Response('Missing code', { status: 400 })

  // latex.codecogs.com — use POST to avoid URL length limits
  const res = await fetch('https://latex.codecogs.com/png.latex', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'igcse-tools/1.0',
    },
    body: `latex=${encodeURIComponent(code)}`,
  })

  if (!res.ok) {
    return new Response(`Codecogs error: HTTP ${res.status}`, { status: 502 })
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
