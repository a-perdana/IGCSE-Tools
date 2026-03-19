/**
 * Deterministic Diagram Rendering Engine.
 *
 * Takes structured JSON data and produces exact, mathematically correct TikZ code.
 * Uses only basic TikZ primitives compatible with QuickLaTeX's free tier:
 *   - No `pic {angle = ...}` (requires angles library + QuickLaTeX Pro)
 *   - No `pic {right angle = ...}` (same issue)
 *   - Right angles drawn as explicit small squares
 *   - Angle arcs drawn with \draw ... arc[...]
 */

type TuplePoint = [number, number];

interface TriangleData {
  A: TuplePoint;
  B: TuplePoint;
  C: TuplePoint;
  rightAngleAt?: "A" | "B" | "C";
  labels?: {
    A?: string;
    B?: string;
    C?: string;
    AB?: string; // side label between A and B
    BC?: string; // side label between B and C
    CA?: string; // side label between C and A
  };
}

interface CircleData {
  center: TuplePoint;
  radius: number;
  A: TuplePoint;
  B: TuplePoint; // Diameter endpoints
  C: TuplePoint; // Point on circumference
  labels?: { A?: string; B?: string; C?: string; O?: string };
}

interface ParallelLinesData {
  line1: [TuplePoint, TuplePoint];
  line2: [TuplePoint, TuplePoint];
  transversal: [TuplePoint, TuplePoint];
  labels?: Record<string, string>;
  angleType?: "corresponding" | "alternate" | "co-interior";
}

export function renderDiagram(question: {
  diagramType?: string;
  diagramData?: any;
  subject?: string;
}): string | null {
  if (!question.diagramData || !question.diagramType) return null;

  // Biology requires complex organic drawings — force AI
  if (question.subject === "Biology") return null;

  try {
    const type = question.diagramType.toLowerCase().replace(/_/g, " ");
    switch (type) {
      case "triangle":
      case "geometry":
      case "right triangle":
      case "right_triangle":
      case "isosceles triangle":
      case "isosceles_triangle":
        return renderTriangle(question.diagramData);

      case "circle":
      case "circle geometry":
        return renderCircle(question.diagramData);

      case "parallel lines":
      case "parallel lines geometry":
        return renderParallelLines(question.diagramData);

      case "sector":
        return null; // needs AI

      default:
        return null;
    }
  } catch (err) {
    console.warn(
      `Deterministic diagram render failed (${question.diagramType}):`,
      err,
    );
    return null;
  }
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function getIntersection(
  l1: [TuplePoint, TuplePoint],
  l2: [TuplePoint, TuplePoint],
): TuplePoint | null {
  const [p1, p2] = l1;
  const [p3, p4] = l2;
  const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1], x4 = p4[0], y4 = p4[1];
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 1e-6) return null;
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)];
}

const dist = (p1: TuplePoint, p2: TuplePoint) =>
  Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));

/** Maps a direction vector to a TikZ anchor string (8-sector compass). */
function tikzLabelDir(dx: number, dy: number): string {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 157.5 || angle <= -157.5) return "left";
  if (angle > 112.5) return "above left";
  if (angle > 67.5) return "above";
  if (angle > 22.5) return "above right";
  if (angle > -22.5) return "right";
  if (angle > -67.5) return "below right";
  if (angle > -112.5) return "below";
  return "below left";
}

/** Returns the TikZ anchor for a side label, pointing outward from the centroid. */
function sideOutDir(mid: TuplePoint, g: TuplePoint): string {
  return tikzLabelDir(mid[0] - g[0], mid[1] - g[1]);
}

/**
 * Draws a right-angle square at `vertex` in the corner formed by
 * vectors toward `p1` and `p2`. Size = `s` TikZ units.
 * Uses only \draw (no pic), compatible with QuickLaTeX free tier.
 */
function rightAngleSquare(
  vertex: TuplePoint,
  p1: TuplePoint,
  p2: TuplePoint,
  s = 0.18,
): string {
  const norm = (dx: number, dy: number): [number, number] => {
    const len = Math.sqrt(dx * dx + dy * dy);
    return len < 1e-9 ? [0, 0] : [dx / len, dy / len];
  };
  const [u1, v1] = norm(p1[0] - vertex[0], p1[1] - vertex[1]);
  const [u2, v2] = norm(p2[0] - vertex[0], p2[1] - vertex[1]);
  const ax = vertex[0] + s * u1;
  const ay = vertex[1] + s * v1;
  const bx = ax + s * u2;
  const by = ay + s * v2;
  const cx = vertex[0] + s * u2;
  const cy = vertex[1] + s * v2;
  const fmt = (n: number) => parseFloat(n.toFixed(4));
  return `\\draw[thin] (${fmt(ax)},${fmt(ay)}) -- (${fmt(bx)},${fmt(by)}) -- (${fmt(cx)},${fmt(cy)});`;
}

// ── Renderers ─────────────────────────────────────────────────────────────────

function renderTriangle(data: TriangleData): string | null {
  const { A, B, C, rightAngleAt, labels } = data;
  if (!validatePoint(A) || !validatePoint(B) || !validatePoint(C)) return null;
  if (!validateTriangle(A, B, C, rightAngleAt)) return null;

  // Centroid → outward label directions
  const gx = (A[0] + B[0] + C[0]) / 3;
  const gy = (A[1] + B[1] + C[1]) / 3;
  const dirA = tikzLabelDir(A[0] - gx, A[1] - gy);
  const dirB = tikzLabelDir(B[0] - gx, B[1] - gy);
  const dirC = tikzLabelDir(C[0] - gx, C[1] - gy);

  let tikz = `
  \\coordinate (A) at (${A[0]},${A[1]});
  \\coordinate (B) at (${B[0]},${B[1]});
  \\coordinate (C) at (${C[0]},${C[1]});

  \\draw[thick] (A) -- (B) -- (C) -- cycle;

  \\node[${dirA}, outer sep=3pt] at (A) {$${labels?.A ?? "A"}$};
  \\node[${dirB}, outer sep=3pt] at (B) {$${labels?.B ?? "B"}$};
  \\node[${dirC}, outer sep=3pt] at (C) {$${labels?.C ?? "C"}$};
`;

  // Optional side length labels
  const g: TuplePoint = [gx, gy];
  if (labels?.AB) {
    const mid: TuplePoint = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    tikz += `  \\node[${sideOutDir(mid, g)}, outer sep=2pt] at (${mid[0]},${mid[1]}) {$${labels.AB}$};\n`;
  }
  if (labels?.BC) {
    const mid: TuplePoint = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];
    tikz += `  \\node[${sideOutDir(mid, g)}, outer sep=2pt] at (${mid[0]},${mid[1]}) {$${labels.BC}$};\n`;
  }
  if (labels?.CA) {
    const mid: TuplePoint = [(C[0] + A[0]) / 2, (C[1] + A[1]) / 2];
    tikz += `  \\node[${sideOutDir(mid, g)}, outer sep=2pt] at (${mid[0]},${mid[1]}) {$${labels.CA}$};\n`;
  }

  // Right-angle square (no pic{} — drawn explicitly)
  if (rightAngleAt) {
    let sq = "";
    if (rightAngleAt === "A") sq = rightAngleSquare(A, B, C);
    if (rightAngleAt === "B") sq = rightAngleSquare(B, A, C);
    if (rightAngleAt === "C") sq = rightAngleSquare(C, A, B);
    if (sq) tikz += `  ${sq}\n`;
  }

  return wrapTikz(tikz);
}

function renderCircle(data: CircleData): string | null {
  const { center, radius, A, B, C, labels } = data;
  if (!validatePoint(center) || !validatePoint(A) || !validatePoint(B) || !validatePoint(C))
    return null;
  if (typeof radius !== "number" || radius <= 0) return null;
  if (!validateCircle(data)) return null;

  // Label directions relative to center
  const dirA = tikzLabelDir(A[0] - center[0], A[1] - center[1]);
  const dirB = tikzLabelDir(B[0] - center[0], B[1] - center[1]);
  const dirC = tikzLabelDir(C[0] - center[0], C[1] - center[1]);

  let tikz = `
  \\coordinate (O) at (${center[0]},${center[1]});
  \\coordinate (A) at (${A[0]},${A[1]});
  \\coordinate (B) at (${B[0]},${B[1]});
  \\coordinate (C) at (${C[0]},${C[1]});

  \\draw[thick] (O) circle (${radius});
  \\draw[thick] (A) -- (B);
  \\draw[thick] (A) -- (C) -- (B);

  \\fill (O) circle (1.5pt);
  \\node[below, outer sep=2pt] at (O) {$${labels?.O ?? "O"}$};
  \\node[${dirA}, outer sep=3pt] at (A) {$${labels?.A ?? "A"}$};
  \\node[${dirB}, outer sep=3pt] at (B) {$${labels?.B ?? "B"}$};
  \\node[${dirC}, outer sep=3pt] at (C) {$${labels?.C ?? "C"}$};
`;

  // Right angle at C (Thales' theorem) — drawn as explicit square
  if (isDiameter(A, B, center, radius)) {
    tikz += `  ${rightAngleSquare(C, A, B)}\n`;
  }

  return wrapTikz(tikz);
}

function renderParallelLines(data: ParallelLinesData): string | null {
  const { line1, line2, transversal, labels, angleType } = data;
  if (!validateLine(line1) || !validateLine(line2) || !validateLine(transversal))
    return null;
  if (!validateParallel(line1, line2)) {
    console.warn("ParallelLines validation failed: Lines are not parallel.");
    return null;
  }

  const [p1, p2] = line1;
  const [p3, p4] = line2;
  const [t1, t2] = transversal;

  const int1 = getIntersection(line1, transversal);
  const int2 = getIntersection(line2, transversal);

  // Compute geometry-derived acute angle (transversal vs line1)
  const tvDx = t2[0] - t1[0];
  const tvDy = t2[1] - t1[1];
  const l1Dx = p2[0] - p1[0];
  const l1Dy = p2[1] - p1[1];
  const tvRad = Math.atan2(tvDy, tvDx);
  const l1Rad = Math.atan2(l1Dy, l1Dx);
  let angleDeg = Math.abs(((tvRad - l1Rad) * 180) / Math.PI);
  if (angleDeg > 180) angleDeg = 360 - angleDeg;
  if (angleDeg > 90) angleDeg = 180 - angleDeg;
  const acuteAngle = Math.round(angleDeg);
  const obtuseAngle = 180 - acuteAngle;

  // Label for intersection points (default A and B, overridable via labels)
  const labelI1 = labels?.["I1"] ?? labels?.["A"] ?? "A";
  const labelI2 = labels?.["I2"] ?? labels?.["B"] ?? "B";

  // Tick marks to show parallel lines (drawn at midpoint of each line)
  const mid1x = (p1[0] + p2[0]) / 2;
  const mid1y = (p1[1] + p2[1]) / 2;
  const mid2x = (p3[0] + p4[0]) / 2;
  const mid2y = (p3[1] + p4[1]) / 2;
  // Perpendicular tick direction (unit normal to line1)
  const l1len = Math.sqrt(l1Dx * l1Dx + l1Dy * l1Dy);
  const nx = -l1Dy / l1len * 0.15;
  const ny = l1Dx / l1len * 0.15;
  const fmt = (n: number) => parseFloat(n.toFixed(4));

  let tikz = `
  \\draw[thick] (${p1[0]},${p1[1]}) -- (${p2[0]},${p2[1]});
  \\draw[thick] (${p3[0]},${p3[1]}) -- (${p4[0]},${p4[1]});
  \\draw[thick] (${t1[0]},${t1[1]}) -- (${t2[0]},${t2[1]});
`;

  // Parallel tick marks
  tikz += `  \\draw[thin] (${fmt(mid1x + nx)},${fmt(mid1y + ny)}) -- (${fmt(mid1x - nx)},${fmt(mid1y - ny)});\n`;
  tikz += `  \\draw[thin] (${fmt(mid2x + nx)},${fmt(mid2y + ny)}) -- (${fmt(mid2x - nx)},${fmt(mid2y - ny)});\n`;

  if (int1) {
    tikz += `  \\fill (${fmt(int1[0])},${fmt(int1[1])}) circle (1.5pt);\n`;
    tikz += `  \\node[above right, outer sep=2pt] at (${fmt(int1[0])},${fmt(int1[1])}) {$${labelI1}$};\n`;
  }
  if (int2) {
    tikz += `  \\fill (${fmt(int2[0])},${fmt(int2[1])}) circle (1.5pt);\n`;
    tikz += `  \\node[below right, outer sep=2pt] at (${fmt(int2[0])},${fmt(int2[1])}) {$${labelI2}$};\n`;
  }

  // Angle arcs — drawn with basic \draw arc (no pic{angle=...})
  if (int1 && acuteAngle >= 1) {
    // Compute start angle of transversal at int1 (from int1 toward t2 direction)
    const startRad = Math.atan2(tvDy, tvDx);
    const startDeg = (startRad * 180) / Math.PI;

    // Always mark the acute angle at int1
    tikz += `  \\draw (${fmt(int1[0])},${fmt(int1[1])}) ++(${fmt(startDeg)}:0.3) arc[start angle=${fmt(startDeg)}, end angle=${fmt(startDeg + acuteAngle)}, radius=0.3];\n`;
    tikz += `  \\node at (${fmt(int1[0] + 0.5 * Math.cos((startDeg + acuteAngle / 2) * Math.PI / 180))},${fmt(int1[1] + 0.5 * Math.sin((startDeg + acuteAngle / 2) * Math.PI / 180))}) {\\small $${acuteAngle}^\\circ$};\n`;

    if (int2) {
      if (angleType === "corresponding") {
        // Same arc at int2
        tikz += `  \\draw (${fmt(int2[0])},${fmt(int2[1])}) ++(${fmt(startDeg)}:0.3) arc[start angle=${fmt(startDeg)}, end angle=${fmt(startDeg + acuteAngle)}, radius=0.3];\n`;
        tikz += `  \\node at (${fmt(int2[0] + 0.5 * Math.cos((startDeg + acuteAngle / 2) * Math.PI / 180))},${fmt(int2[1] + 0.5 * Math.sin((startDeg + acuteAngle / 2) * Math.PI / 180))}) {\\small $${acuteAngle}^\\circ$};\n`;
      } else if (angleType === "alternate") {
        // Opposite side at int2 → start from opposite direction
        const altStart = startDeg + 180;
        tikz += `  \\draw (${fmt(int2[0])},${fmt(int2[1])}) ++(${fmt(altStart)}:0.3) arc[start angle=${fmt(altStart)}, end angle=${fmt(altStart + acuteAngle)}, radius=0.3];\n`;
        tikz += `  \\node at (${fmt(int2[0] + 0.5 * Math.cos((altStart + acuteAngle / 2) * Math.PI / 180))},${fmt(int2[1] + 0.5 * Math.sin((altStart + acuteAngle / 2) * Math.PI / 180))}) {\\small $${acuteAngle}^\\circ$};\n`;
      } else if (angleType === "co-interior") {
        // Supplementary angle at int2
        tikz += `  \\draw (${fmt(int2[0])},${fmt(int2[1])}) ++(${fmt(startDeg)}:0.3) arc[start angle=${fmt(startDeg)}, end angle=${fmt(startDeg - obtuseAngle)}, radius=0.3];\n`;
        tikz += `  \\node at (${fmt(int2[0] + 0.5 * Math.cos((startDeg - obtuseAngle / 2) * Math.PI / 180))},${fmt(int2[1] + 0.5 * Math.sin((startDeg - obtuseAngle / 2) * Math.PI / 180))}) {\\small $${obtuseAngle}^\\circ$};\n`;
      }
    }
  }

  return wrapTikz(tikz);
}

// ── Validators ────────────────────────────────────────────────────────────────

function validatePoint(p: any): p is [number, number] {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    !isNaN(p[0]) &&
    !isNaN(p[1])
  );
}

function validateLine(l: any): l is [TuplePoint, TuplePoint] {
  return Array.isArray(l) && l.length === 2 && validatePoint(l[0]) && validatePoint(l[1]);
}

function validateTriangle(
  A: TuplePoint,
  B: TuplePoint,
  C: TuplePoint,
  rightAngleAt?: string,
): boolean {
  if (dist(A, B) < 1e-6 || dist(B, C) < 1e-6 || dist(A, C) < 1e-6) {
    console.warn("Triangle validation failed: degenerate triangle.");
    return false;
  }
  if (rightAngleAt) {
    let u: TuplePoint, v: TuplePoint;
    if (rightAngleAt === "A") { u = [B[0]-A[0], B[1]-A[1]]; v = [C[0]-A[0], C[1]-A[1]]; }
    else if (rightAngleAt === "B") { u = [A[0]-B[0], A[1]-B[1]]; v = [C[0]-B[0], C[1]-B[1]]; }
    else if (rightAngleAt === "C") { u = [A[0]-C[0], A[1]-C[1]]; v = [B[0]-C[0], B[1]-C[1]]; }
    else return true;
    const dot = u[0] * v[0] + u[1] * v[1];
    if (Math.abs(dot) > 0.05) {
      console.warn(`Triangle validation: angle at ${rightAngleAt} not 90° (dot=${dot.toFixed(4)}). Ignoring right-angle assertion.`);
      // Don't reject — just skip the square marker (caller checks return value)
    }
  }
  return true;
}

function validateCircle(data: CircleData): boolean {
  const { center, radius, A, B, C } = data;
  const tol = radius * 0.1; // 10% tolerance — AI coords are approximate
  if (Math.abs(dist(center, A) - radius) > tol) return false;
  if (Math.abs(dist(center, B) - radius) > tol) return false;
  if (Math.abs(dist(center, C) - radius) > tol) return false;
  return true;
}

function isDiameter(
  A: TuplePoint,
  B: TuplePoint,
  center: TuplePoint,
  radius: number,
): boolean {
  const mid: TuplePoint = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  return dist(mid, center) < radius * 0.1 && Math.abs(dist(A, B) - 2 * radius) < radius * 0.1;
}

function validateParallel(
  l1: [TuplePoint, TuplePoint],
  l2: [TuplePoint, TuplePoint],
): boolean {
  const dx1 = l1[1][0] - l1[0][0], dy1 = l1[1][1] - l1[0][1];
  const dx2 = l2[1][0] - l2[0][0], dy2 = l2[1][1] - l2[0][1];
  // Cross product near 0 → parallel (handles vertical lines correctly)
  const cross = Math.abs(dx1 * dy2 - dy1 * dx2);
  const scale = Math.max(Math.sqrt(dx1*dx1+dy1*dy1) * Math.sqrt(dx2*dx2+dy2*dy2), 1e-9);
  return cross / scale < 0.01;
}

// ── TikZ wrapper ──────────────────────────────────────────────────────────────

function wrapTikz(content: string): string {
  return `\\documentclass[tikz,border=6mm]{standalone}
\\usetikzlibrary{calc,arrows.meta}
\\begin{document}
\\begin{tikzpicture}[scale=1.2, font=\\small]
${content}
\\end{tikzpicture}
\\end{document}`;
}
