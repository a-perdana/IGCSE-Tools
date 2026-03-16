import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * Converts oklch() color values to rgb() so html2canvas (which doesn't
 * support oklch) can render Tailwind v4 styles correctly.
 */
function oklchToRgbStr(L: number, C: number, H: number, alpha?: number): string {
  const hRad = H * (Math.PI / 180)
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b
  const lc = l_ ** 3, mc = m_ ** 3, sc = s_ ** 3
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255)
  const r = clamp(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc)
  const g = clamp(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc)
  const bv = clamp(-0.0041960863 * lc - 0.7034186147 * mc + 1.7076147010 * sc)
  return alpha !== undefined
    ? `rgba(${r},${g},${bv},${alpha})`
    : `rgb(${r},${g},${bv})`
}

function replaceOklchInCss(css: string): string {
  return css.replace(
    /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/g,
    (_, L, C, H, A) => {
      const lv = L.includes('%') ? parseFloat(L) / 100 : parseFloat(L)
      const alpha = A !== undefined
        ? (A.includes('%') ? parseFloat(A) / 100 : parseFloat(A))
        : undefined
      return oklchToRgbStr(lv, parseFloat(C), parseFloat(H), alpha)
    }
  )
}

const COLOR_PROPS = [
  'color', 'background-color', 'border-color',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline-color', 'fill', 'stroke', 'text-decoration-color', 'caret-color',
  'column-rule-color', 'accent-color',
]

export async function exportToPDF(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    useCORS: true,
    scale: 2,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc: Document) => {
      // Replace oklch in <style> tag text
      clonedDoc.querySelectorAll('style').forEach(s => {
        if (s.textContent) s.textContent = replaceOklchInCss(s.textContent)
      })
      // html2canvas reads computed styles directly; CSS variables resolve to oklch.
      // Force-resolve each element's color properties as inline styles.
      const view = clonedDoc.defaultView
      if (!view) return
      clonedDoc.querySelectorAll<HTMLElement>('*').forEach(el => {
        const computed = view.getComputedStyle(el)
        for (const prop of COLOR_PROPS) {
          const val = computed.getPropertyValue(prop)
          if (val.includes('oklch')) {
            el.style.setProperty(prop, replaceOklchInCss(val))
          }
        }
      })
    },
  })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgH = (canvas.height * pageW) / canvas.width
  let heightLeft = imgH
  let position = 0
  pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH)
  heightLeft -= pageH
  while (heightLeft > 0) {
    position = heightLeft - imgH
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH)
    heightLeft -= pageH
  }
  pdf.save(filename)
}
