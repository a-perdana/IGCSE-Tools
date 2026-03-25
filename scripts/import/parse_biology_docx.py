#!/usr/bin/env python3
"""
parse_biology_docx.py
Parses IGCSE Biology topical questions docx into structured JSON.

Usage:
    python parse_biology_docx.py path/to/questions.docx

Output (in same directory as docx):
    import_output/questions.json  — structured question data
    import_output/images/         — extracted PNG images

Requirements:
    pandoc (on PATH)
"""

import re
import json
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import zipfile
import subprocess
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

# ─── Data structures ──────────────────────────────────────────────────────────

@dataclass
class ParsedQuestion:
    uid: str
    source: str = "imported"
    subjectCode: str = "0610"
    subject: str = "Biology"
    rawCode: str = ""
    paperCode: str = ""       # e.g. "0610/12/F/M/2024"
    paper: str = ""           # "1" | "2" | "specimen"
    session: str = ""         # e.g. "F/M" | "O/N" | "M/J"
    year: str = ""            # e.g. "2024"
    questionNumber: Optional[int] = None
    topic: str = ""
    subtopic: Optional[str] = None
    type: str = "mcq"
    questionText: str = ""
    options: list = field(default_factory=list)  # ["A text", "B text", "C text", "D text"]
    correctAnswer: Optional[str] = None          # null — not available in source
    hasImage: bool = False
    imageName: Optional[str] = None              # primary image filename
    allImageNames: list = field(default_factory=list)  # all images in question
    imageStoragePath: Optional[str] = None       # Firebase Storage path (set after upload)
    imageURL: Optional[str] = None               # download URL (set after upload)
    status: str = "active"                       # active | archived
    isPublic: bool = True

# ─── Regex patterns ───────────────────────────────────────────────────────────

# Topic heading: "1\. Characteristics..." (pandoc escapes the dot)
# Matches: "4\. Biological molecules" or "7. Human nutrition" (some may not escape)
TOPIC_RE = re.compile(r'^(\d{1,2})\\\.\s+(.+)$')

# Subsection: "### Xylem and Phloem" (1–3 hashes)
SUBTOPIC_RE = re.compile(r'^#{1,3}\s+(.+)$')

# Question code — covers all observed formats:
#   0610/12/F/M/2024-1     (standard: session in two parts)
#   0610/11/O/N/23         (abbreviated year, no question number)
#   0610/01/SP/2020-2      (specimen paper)
#   [0610/22/M/J/2024-5]{.mark}  (highlighted code)
CODE_CONTENT_RE = re.compile(
    r'0610/\d{2}/(?:[A-Z]{1,2}/[A-Z]{1,2}|[A-Z]{2,4})/\d{2,4}(?:-\d+)?'
)

# Full line patterns for question code
CODE_LINE_SIMPLE_RE = re.compile(
    r'^\*\*\[?(0610/\d{2}/(?:[A-Z]{1,2}/[A-Z]{1,2}|[A-Z]{2,4})/\d{2,4}(?:-\d+)?)\]?\*\*$'
)

# Image reference in pandoc markdown
IMAGE_RE = re.compile(r'!\[.*?\]\(media/(image\d+\.(?:png|jpg|jpeg))\)')

# MCQ option on its own line (handles bold, plain, highlighted variants)
#   "A breathing"  |  "**A** breathing"  |  "[A adaptation]{.mark}"
OPTION_LINE_RE = re.compile(
    r'^(?:\[)?\*{0,2}([A-D])\*{0,2}(?:\])?\s{1,3}(.+?)(?:\{\.mark\})?$'
)

# All four options on a single line: "**A** foo **B** bar **C** baz **D** qux"
INLINE_OPTIONS_RE = re.compile(
    r'\*{0,2}A\*{0,2}\s+(.+?)\s+\*{0,2}B\*{0,2}\s+(.+?)\s+\*{0,2}C\*{0,2}\s+(.+?)\s+\*{0,2}D\*{0,2}\s+(.+?)$'
)

# Strip highlight spans: [text]{.mark}
MARK_RE = re.compile(r'\[([^\]]+)\]\{\.mark\}')

# ─── Helpers ──────────────────────────────────────────────────────────────────

def parse_code(raw_code: str) -> dict:
    """Decompose a raw Cambridge question code into structured fields."""
    # Standard: 0610/12/F/M/2024-13
    m = re.match(
        r'(\d{4})/(\d{2})/([A-Z]{1,2})/([A-Z]{1,2})/(\d{2,4})(?:-(\d+))?$',
        raw_code
    )
    if m:
        subject_code, paper_var, s1, s2, year_raw, q_num = m.groups()
        paper_var_int = int(paper_var)
        paper = '1' if paper_var_int < 20 else '2'
        session = f"{s1}/{s2}"
        year = f"20{year_raw}" if len(year_raw) == 2 else year_raw
        return {
            'paperCode': f"{subject_code}/{paper_var}/{s1}/{s2}/{year_raw}",
            'paper': paper,
            'session': session,
            'year': year,
            'questionNumber': int(q_num) if q_num else None
        }

    # Specimen: 0610/01/SP/2020-2
    m = re.match(r'(\d{4})/(\d{2})/([A-Z]+)/(\d{2,4})(?:-(\d+))?$', raw_code)
    if m:
        subject_code, paper_var, session_code, year_raw, q_num = m.groups()
        year = f"20{year_raw}" if len(year_raw) == 2 else year_raw
        return {
            'paperCode': f"{subject_code}/{paper_var}/{session_code}/{year_raw}",
            'paper': 'specimen',
            'session': session_code,
            'year': year,
            'questionNumber': int(q_num) if q_num else None
        }

    return {'paperCode': raw_code, 'paper': '', 'session': '', 'year': '', 'questionNumber': None}


def clean_text(text: str) -> str:
    """Remove markdown decoration, keeping readable text."""
    text = MARK_RE.sub(r'\1', text)               # [text]{.mark} → text
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # **bold** → bold
    text = re.sub(r'\*(.+?)\*', r'\1', text)       # *italic* → italic
    text = IMAGE_RE.sub('[DIAGRAM]', text)          # image refs → placeholder
    text = re.sub(r'\s*>?\s*(?:height|width)="[^"]+"\s*\}?\s*', ' ', text)  # pandoc img attrs
    text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)  # blockquote >
    text = re.sub(r'\{[^}]+\}', '', text)          # {.mark} remnants
    text = re.sub(r'\s{2,}', ' ', text)            # collapse spaces
    return text.strip()


def extract_question_code(line: str) -> Optional[str]:
    """Return the Cambridge question code if this line is a code line, else None."""
    stripped = line.strip()
    # Try direct bold-wrapped pattern
    m = CODE_LINE_SIMPLE_RE.match(stripped)
    if m:
        return m.group(1)
    # Try extracting from inline context (e.g. "[**0610/...**]{.mark}")
    codes = CODE_CONTENT_RE.findall(stripped)
    # Only treat as a code line if the whole line is essentially just the code
    if codes and len(stripped) < len(codes[0]) + 20:
        return codes[0]
    return None


def parse_options(lines: list[str]) -> tuple[list[str], list[int]]:
    """
    Extract MCQ options A–D from a list of lines.
    Returns (options_list, indices_of_option_lines).
    options_list = [text_A, text_B, text_C, text_D] (empty strings if not found)
    """
    options_dict: dict[str, str] = {}
    option_line_indices: list[int] = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue

        # Try single-line all-options pattern first
        m = INLINE_OPTIONS_RE.match(stripped)
        if m:
            for letter, text in zip('ABCD', m.groups()):
                options_dict[letter] = clean_text(text)
            option_line_indices.append(i)
            break

        # Try per-line option
        m = OPTION_LINE_RE.match(stripped)
        if m:
            letter, text = m.groups()
            if letter not in options_dict:
                options_dict[letter] = clean_text(text)
                option_line_indices.append(i)

    result = [
        options_dict.get('A', ''),
        options_dict.get('B', ''),
        options_dict.get('C', ''),
        options_dict.get('D', ''),
    ]
    return result, option_line_indices


def parse_question_block(
    lines: list[str],
    topic: str,
    subtopic: Optional[str],
    raw_code: str,
    uid: str
) -> Optional[ParsedQuestion]:
    """Turn a raw block of markdown lines into a ParsedQuestion."""

    code_info = parse_code(raw_code)

    q = ParsedQuestion(
        uid=uid,
        rawCode=raw_code,
        topic=topic,
        subtopic=subtopic,
        **code_info
    )

    # Collect all image references in this block
    images: list[str] = []
    for line in lines:
        m = IMAGE_RE.search(line)
        if m:
            images.append(m.group(1))

    if images:
        q.hasImage = True
        q.imageName = images[0]
        q.allImageNames = images
        q.imageStoragePath = f"diagrams/biology/{images[0]}"

    # Extract MCQ options
    options, option_indices = parse_options(lines)

    has_abcd = sum(1 for o in options if o) >= 2
    if has_abcd:
        q.type = 'mcq'
        q.options = options

    # Question text = everything before the first option line (excluding images)
    first_opt_idx = option_indices[0] if option_indices else len(lines)
    question_lines: list[str] = []
    for line in lines[:first_opt_idx]:
        stripped = line.strip()
        if not stripped:
            continue
        if IMAGE_RE.search(stripped):
            continue   # image embedded inline; noted via hasImage flag
        question_lines.append(stripped)

    raw_q = ' '.join(question_lines)
    q.questionText = clean_text(raw_q)

    # Must have non-empty question text
    if not q.questionText:
        return None

    return q

# ─── Main parser ──────────────────────────────────────────────────────────────

def parse_markdown(md_text: str) -> list[ParsedQuestion]:
    """Walk pandoc markdown and yield ParsedQuestion objects."""
    lines = md_text.split('\n')
    questions: list[ParsedQuestion] = []

    current_topic = ""
    current_subtopic: Optional[str] = None
    current_block: list[str] = []
    in_document = False
    uid_counter = 0

    def flush_block(raw_code: str):
        nonlocal uid_counter
        if not current_block or not current_topic:
            return
        uid_counter += 1
        uid = f"biol_{uid_counter:04d}"
        q = parse_question_block(current_block, current_topic, current_subtopic, raw_code, uid)
        if q:
            questions.append(q)

    for line in lines:
        stripped = line.strip()

        # ── Detect document start (first topic heading) ──────────────────────
        if not in_document:
            m = TOPIC_RE.match(stripped)
            if m and int(m.group(1)) >= 1 and not m.group(2).strip().endswith('.'):
                in_document = True
                current_topic = m.group(2).strip()
                current_subtopic = None
                current_block = []
            continue

        # ── Topic heading ─────────────────────────────────────────────────────
        m = TOPIC_RE.match(stripped)
        if m and int(m.group(1)) >= 1 and not m.group(2).strip().endswith('.'):
            current_topic = m.group(2).strip()
            current_subtopic = None
            current_block = []
            continue

        # ── Sub-section heading ───────────────────────────────────────────────
        m = SUBTOPIC_RE.match(stripped)
        if m:
            current_subtopic = m.group(1).strip()
            current_block = []
            continue

        # ── Question code (end of question block) ─────────────────────────────
        code = extract_question_code(line)
        if code:
            flush_block(code)
            current_block = []
            continue

        # ── Accumulate into current block ─────────────────────────────────────
        current_block.append(line)

    return questions

# ─── Image extraction ─────────────────────────────────────────────────────────

def extract_images(docx_path: Path, output_dir: Path) -> int:
    """Unzip docx and copy word/media/* to output_dir. Returns count."""
    output_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    with zipfile.ZipFile(docx_path, 'r') as z:
        for entry in z.namelist():
            if entry.startswith('word/media/') and not entry.endswith('/'):
                filename = Path(entry).name
                data = z.read(entry)
                (output_dir / filename).write_bytes(data)
                count += 1
    return count

# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: python parse_biology_docx.py path/to/questions.docx")
        sys.exit(1)

    docx_path = Path(sys.argv[1]).resolve()
    if not docx_path.exists():
        print(f"Error: file not found: {docx_path}")
        sys.exit(1)

    output_dir = docx_path.parent / "import_output"
    images_dir = output_dir / "images"
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"📄  Source : {docx_path.name}")

    # ── Step 1: pandoc → markdown ─────────────────────────────────────────────
    md_path = output_dir / "questions.md"
    print("🔄  Running pandoc…")
    result = subprocess.run(
        ['pandoc', '--track-changes=all', str(docx_path), '-o', str(md_path)],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"❌  Pandoc failed:\n{result.stderr}")
        sys.exit(1)

    # ── Step 2: extract images ────────────────────────────────────────────────
    print("🖼️   Extracting images…")
    img_count = extract_images(docx_path, images_dir)
    print(f"    Extracted {img_count} images → {images_dir}")

    # ── Step 3: parse ─────────────────────────────────────────────────────────
    print("🔍  Parsing questions…")
    md_text = md_path.read_text(encoding='utf-8')
    questions = parse_markdown(md_text)

    # ── Step 4: stats ─────────────────────────────────────────────────────────
    with_images = sum(1 for q in questions if q.hasImage)
    by_topic: dict[str, int] = {}
    for q in questions:
        by_topic[q.topic] = by_topic.get(q.topic, 0) + 1

    print(f"\n✅  Parsed {len(questions)} questions  ({with_images} with diagrams)\n")
    print("📊  Questions by topic:")
    for topic, count in sorted(by_topic.items(), key=lambda x: -x[1]):
        bar = '█' * (count // 5)
        print(f"    {count:4d}  {bar}  {topic}")

    paper_counts: dict[str, int] = {}
    for q in questions:
        paper_counts[q.paper] = paper_counts.get(q.paper, 0) + 1
    print("\n📋  By paper type:")
    for p, cnt in sorted(paper_counts.items()):
        label = {"1": "Paper 1 (MCQ)", "2": "Paper 2 (Structured)", "specimen": "Specimen"}.get(p, p)
        print(f"    {cnt:4d}  {label}")

    # ── Step 5: write JSON ────────────────────────────────────────────────────
    output = {
        "metadata": {
            "source": docx_path.name,
            "parsedAt": __import__('datetime').datetime.utcnow().isoformat() + 'Z',
            "totalQuestions": len(questions),
            "withImages": with_images,
            "byTopic": by_topic,
            "byPaper": paper_counts,
        },
        "questions": [asdict(q) for q in questions]
    }

    out_path = output_dir / "questions.json"
    out_path.write_text(
        json.dumps(output, indent=2, ensure_ascii=False),
        encoding='utf-8'
    )
    print(f"\n💾  Output : {out_path}")
    print(f"🖼️   Images : {images_dir}/")
    print(f"\nNext step:")
    print(f"  python upload_to_firebase.py \\")
    print(f"      {out_path} \\")
    print(f"      {images_dir} \\")
    print(f"      --key path/to/igcse-tools-service-account.json")


if __name__ == "__main__":
    main()
