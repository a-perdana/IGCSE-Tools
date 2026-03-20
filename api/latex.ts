/**
 * Vercel Edge Function — QuickLaTeX proxy (full document mode).
 * Accepts POST { code: string } — a full \documentclass standalone document.
 * Uses QuickLaTeX mode=1 which supports complete LaTeX documents.
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

  // QuickLaTeX mode=1 accepts full \documentclass documents
  const params = [
    `formula=${encodeURIComponent(code)}`,
    `fsize=17px`,
    `fcolor=000000`,
    `bcolor=ffffff`,
    `mode=1`,
    `out=1`,
    `errors=1`,
  ].join('&')

  const qlRes = await fetch('https://quicklatex.com/latex3.f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  const text = await qlRes.text()

  // QuickLaTeX response: "0\n<url> <w> <h>\n" (status 0 = ok) or "1\n<error>\n"
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const status = lines[0]

  if (status === '1' || status?.startsWith('1')) {
    const errMsg = lines.slice(1).join(' ')
    return new Response(`QuickLaTeX error: ${errMsg}`, { status: 502 })
  }

  const urlLine = lines.find(l => l.startsWith('http'))
  if (!urlLine) {
    return new Response(`QuickLaTeX returned no URL. Response: ${text}`, { status: 502 })
  }

  const imageUrl = urlLine.split(/\s+/)[0]

  if (imageUrl.includes('/error.png')) {
    const errMsg = lines.filter(l => !l.startsWith('http') && !/^\d/.test(l)).join(' ')
    return new Response(`QuickLaTeX render error: ${errMsg}`, { status: 502 })
  }

  // Fetch the PNG and proxy it (avoids CORS issues with direct image URL)
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) {
    return new Response(`Failed to fetch rendered image: HTTP ${imgRes.status}`, { status: 502 })
  }

  const buf = await imgRes.arrayBuffer()
  return new Response(buf, {
    headers: {
      'Content-Type': 'image/png',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
