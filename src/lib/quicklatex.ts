/**
 * LaTeX render client — sends a full standalone document to the /api/latex proxy
 * (Vercel Edge Function → latex.codecogs.com), which supports complete TikZ.
 */

interface RenderResult {
  url: string;
  width: number;
  height: number;
}

// Simple in-memory cache keyed by TikZ code
const cache = new Map<string, RenderResult>();

/**
 * Wraps a tikzpicture block into a full standalone LaTeX document.
 * If the input is already a full \documentclass document, returns it as-is.
 */
function buildDocument(code: string): string {
  const trimmed = code.trim();
  if (trimmed.startsWith("\\documentclass")) return trimmed;

  // Extract tikzpicture block if wrapped in something else
  const blockMatch = trimmed.match(
    /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/,
  );
  const tikzBlock = blockMatch ? blockMatch[0] : `\\begin{tikzpicture}\n${trimmed}\n\\end{tikzpicture}`;

  // Extract any \usetikzlibrary calls
  const libMatches = [...trimmed.matchAll(/\\usetikzlibrary\{([^}]+)\}/g)];
  const libs = [...new Set(
    libMatches.flatMap(m => m[1].split(",").map(s => s.trim()).filter(Boolean))
  )];
  const libLine = libs.length > 0 ? `\\usetikzlibrary{${libs.join(",")}}` : "";

  return `\\documentclass[tikz,border=8mm]{standalone}
\\usepackage{tikz}
${libLine}
\\begin{document}
${tikzBlock}
\\end{document}`;
}

/**
 * Fixes common AI TikZ generation mistakes.
 */
function sanitizeTikz(code: string): string {
  return code
    .replace(/\\n/g, "\n")
    .replace(
      /\\\\(draw|node|fill|filldraw|shade|clip|coordinate|path|foreach|pgf|text|begin|end|tikz|usepackage|usetikzlibrary|def|let|scope)\b/g,
      "\\$1",
    )
    .replace(/\+\s*-\s*\(/g, "(")
    .replace(/-\s*\+\s*\(/g, "(")
    .replace(/\+\s*;/g, ";")
    .trim();
}

/**
 * Renders TikZ code and returns a PNG data URL via the /api/latex proxy.
 */
export async function renderTikz(code: string): Promise<RenderResult> {
  const sanitized = sanitizeTikz(code);
  const document = buildDocument(sanitized);

  const cached = cache.get(document);
  if (cached) return cached;

  const res = await fetch("/api/latex", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: document }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`LaTeX render error: HTTP ${res.status}${msg ? ` — ${msg}` : ""}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  // We don't know exact dimensions until the image loads — use defaults
  const result: RenderResult = { url, width: 400, height: 300 };
  cache.set(document, result);
  return result;
}
