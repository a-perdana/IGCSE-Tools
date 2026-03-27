/**
 * ExamView Blackboard ZIP export parser.
 *
 * Parses the 00001_questions.dat / 00001_categories.dat / 00001_itemcategories.dat
 * files inside a Blackboard-format ZIP and returns structured question data.
 */

import JSZip from 'jszip'

// ─── Public types ─────────────────────────────────────────────────────────────

export type ExamViewQuestionType = 'mcq' | 'short_answer'

export interface ExamViewImage {
  /** Filename only, e.g. "mc001-1.jpg" */
  filename: string
  /** Raw bytes from ZIP */
  data: Uint8Array
  /** MIME type */
  mimeType: string
}

export interface ExamViewQuestion {
  /** Original QTI id, e.g. "question_1_1" */
  sourceId: string
  type: ExamViewQuestionType
  /** Markdown-ish question text (HTML stripped) */
  text: string
  /** MCQ options in order */
  options: string[]
  /** For MCQ: "A" | "B" | "C" | "D" */
  correctAnswer: string
  /** Topic from categories (e.g. "0-1 Comparing and Ordering Whole Numbers") */
  topic: string
  /** Learning objective (e.g. "Skills Handbook: Comparing and Ordering Whole Numbers") */
  syllabusObjective: string
  /** L1 → 1, L2 → 2, L3 → 3 */
  difficultyStars: 1 | 2 | 3
  /** Keywords from bbmd_keywords */
  keywords: string[]
  /** Images referenced in the question or options */
  images: ExamViewImage[]
  /** true when question text contains at least one image */
  hasDiagram: boolean
}

export interface ExamViewParseResult {
  /** Source filename (the ZIP name) */
  sourceFile: string
  questions: ExamViewQuestion[]
  /** Images keyed by filename for deduplication across questions */
  allImages: Map<string, ExamViewImage>
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * The question text is HTML stored as XML-encoded text inside <mat_formattedtext>.
 * We need to decode the XML entities first, then parse the resulting HTML.
 * Returns { text, imageFilenames }.
 */
function parseFormattedText(raw: string): { text: string; imageFilenames: string[] } {
  // Step 1: decode XML entities → get actual HTML
  const html = decodeEntities(raw)

  const imageFilenames: string[] = []

  // Step 2: use DOMParser to walk the HTML
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body

  // Collect image filenames from alt attributes
  body.querySelectorAll('img').forEach(img => {
    const alt = img.getAttribute('alt')
    if (alt) imageFilenames.push(alt)
    // Replace img with a placeholder token so text makes sense
    img.replaceWith(`[diagram:${alt ?? 'image'}]`)
  })

  // Convert <b>/<strong> to markdown bold
  body.querySelectorAll('b, strong').forEach(el => {
    const md = `**${el.textContent}**`
    el.replaceWith(md)
  })

  // Convert <br> to newline
  body.querySelectorAll('br').forEach(el => el.replaceWith('\n'))

  // Get text content, collapse whitespace
  let text = body.textContent ?? ''
  text = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()

  return { text, imageFilenames }
}

function getTextFromItem(itemXml: string, selector: RegExp): string {
  const m = itemXml.match(selector)
  if (!m) return ''
  return decodeEntities(m[1]).trim()
}

function parseCorrectAnswer(itemXml: string): string {
  // <respcondition title="correct"> ... <varequal ...>answer_N</varequal>
  const m = itemXml.match(/<respcondition title="correct"[^>]*>[\s\S]*?<varequal[^>]*>(answer_\d+)<\/varequal>/)
  if (!m) return ''
  const answerN = parseInt(m[1].replace('answer_', ''), 10)
  return ['A', 'B', 'C', 'D', 'E'][answerN - 1] ?? ''
}

function parseOptions(itemXml: string): Array<{ ident: string; text: string; imageFilenames: string[] }> {
  const opts: Array<{ ident: string; text: string; imageFilenames: string[] }> = []
  const labelRegex = /<response_label ident="(answer_\d+)"[^>]*>[\s\S]*?<mat_formattedtext[^>]*>([\s\S]*?)<\/mat_formattedtext>/g
  let m
  while ((m = labelRegex.exec(itemXml)) !== null) {
    const { text, imageFilenames } = parseFormattedText(m[2])
    opts.push({ ident: m[1], text, imageFilenames })
  }
  return opts
}

function difficultyLevel(label: string): 1 | 2 | 3 {
  if (label === 'L1') return 1
  if (label === 'L3') return 3
  return 2
}

function mimeFromFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export async function parseExamViewZip(file: File): Promise<ExamViewParseResult> {
  const zip = await JSZip.loadAsync(file)

  // ── Load all four data files ───────────────────────────────────────────────
  const questionsXml = await loadText(zip, /questions\.dat$/)
  const categoriesXml = await loadText(zip, /categories\.dat$/)
  const itemCategoriesXml = await loadText(zip, /itemcategories\.dat$/)

  // ── Build category map: id → { title, type } ──────────────────────────────
  const catMap = new Map<string, { title: string; type: string }>()
  const catRegex = /<CATEGORY id="([^"]+)">\s*<TITLE>([^<]+)<\/TITLE>\s*<TYPE>([^<]+)<\/TYPE>/g
  let cm
  while ((cm = catRegex.exec(categoriesXml)) !== null) {
    catMap.set(cm[1], { title: cm[2], type: cm[3] })
  }

  // ── Build question → [categoryId] map ─────────────────────────────────────
  const questionCats = new Map<string, string[]>()
  const icRegex = /<CATEGORYID value="([^"]+)"\/>\s*<QUESTIONID value="([^"]+)"\/>/g
  let ic
  while ((ic = icRegex.exec(itemCategoriesXml)) !== null) {
    const qid = ic[2]
    const arr = questionCats.get(qid) ?? []
    arr.push(ic[1])
    questionCats.set(qid, arr)
  }

  // ── Collect all image files from ZIP ──────────────────────────────────────
  const allImages = new Map<string, ExamViewImage>()
  const imagePathMap = new Map<string, string>() // filename → zipPath
  for (const zipPath of Object.keys(zip.files)) {
    if (/\.(jpg|jpeg|png|gif)$/i.test(zipPath)) {
      const filename = zipPath.split('/').pop()!
      imagePathMap.set(filename, zipPath)
    }
  }

  // ── Parse each <item> ─────────────────────────────────────────────────────
  const itemRegex = /<item [^>]+>([\s\S]*?)<\/item>/g
  const questions: ExamViewQuestion[] = []
  let im

  while ((im = itemRegex.exec(questionsXml)) !== null) {
    const itemXml = im[0]

    const sourceId = getTextFromItem(itemXml, /bbmd_asi_object_id[^>]*>([^<]+)<\/bbmd_asi_object_id/)
    const qTypeRaw = getTextFromItem(itemXml, /bbmd_questiontype[^>]*>([^<]+)<\/bbmd_questiontype/)
    const keywordsRaw = getTextFromItem(itemXml, /bbmd_keywords[^>]*>([^<]+)<\/bbmd_keywords/)

    const type: ExamViewQuestionType =
      qTypeRaw === 'Multiple Choice' ? 'mcq' : 'short_answer'

    // Question text
    const qtextRaw = itemXml.match(
      /class="QUESTION_BLOCK"[\s\S]*?<mat_formattedtext[^>]*>([\s\S]*?)<\/mat_formattedtext>/
    )?.[1] ?? ''
    const { text: questionText, imageFilenames: qImages } = parseFormattedText(qtextRaw)

    // Options (MCQ only)
    const optionsParsed = type === 'mcq' ? parseOptions(itemXml) : []
    const options = optionsParsed.map(o => o.text)
    const optionImages = optionsParsed.flatMap(o => o.imageFilenames)

    // Correct answer
    const correctAnswer = type === 'mcq' ? parseCorrectAnswer(itemXml) : ''

    // Categories for this question
    const catIds = questionCats.get(sourceId) ?? []
    let topic = ''
    let syllabusObjective = ''
    let diffLabel = 'L2'
    for (const cid of catIds) {
      const cat = catMap.get(cid)
      if (!cat) continue
      if (cat.type === 'category') topic = cat.title
      else if (cat.type === 'learning_objective') syllabusObjective = cat.title
      else if (cat.type === 'level_of_difficulty') diffLabel = cat.title
    }

    // Collect images referenced in this question
    const allFilenames = [...new Set([...qImages, ...optionImages])]
    const questionImages: ExamViewImage[] = []
    for (const filename of allFilenames) {
      if (allImages.has(filename)) {
        questionImages.push(allImages.get(filename)!)
        continue
      }
      const zipPath = imagePathMap.get(filename)
      if (!zipPath) continue
      const data = await zip.files[zipPath].async('uint8array')
      const img: ExamViewImage = { filename, data, mimeType: mimeFromFilename(filename) }
      allImages.set(filename, img)
      questionImages.push(img)
    }

    questions.push({
      sourceId,
      type,
      text: questionText,
      options,
      correctAnswer,
      topic,
      syllabusObjective,
      difficultyStars: difficultyLevel(diffLabel),
      keywords: keywordsRaw.split(',').map(k => k.trim()).filter(Boolean),
      images: questionImages,
      hasDiagram: qImages.length > 0,
    })
  }

  return { sourceFile: file.name, questions, allImages }
}

async function loadText(zip: JSZip, pattern: RegExp): Promise<string> {
  const path = Object.keys(zip.files).find(p => pattern.test(p))
  if (!path) throw new Error(`File matching ${pattern} not found in ZIP`)
  return zip.files[path].async('string')
}
