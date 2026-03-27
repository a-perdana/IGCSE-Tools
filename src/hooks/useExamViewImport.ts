import { useState, useCallback, useRef } from 'react'
import { parseExamViewZip, type ExamViewParseResult } from '../lib/examview'
import { importExamViewQuestions } from '../lib/firebase'

export type ImportStage = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error'

export interface ImportState {
  stage: ImportStage
  parsed: ExamViewParseResult | null
  subject: string
  folderId: string | undefined
  progress: { done: number; total: number }
  error: string | null
  savedCount: number
}

const INITIAL: ImportState = {
  stage: 'idle',
  parsed: null,
  subject: '',
  folderId: undefined,
  progress: { done: 0, total: 0 },
  error: null,
  savedCount: 0,
}

export function useExamViewImport() {
  const [state, setState] = useState<ImportState>(INITIAL)
  // Store parsed result in a ref so confirmImport can read it without stale closure
  const parsedRef = useRef<ExamViewParseResult | null>(null)
  const subjectRef = useRef<string>('')
  const folderRef = useRef<string | undefined>(undefined)

  const pickAndParse = useCallback(async (file: File) => {
    setState(s => ({ ...s, stage: 'parsing', error: null }))
    try {
      const parsed = await parseExamViewZip(file)
      parsedRef.current = parsed
      setState(s => ({ ...s, stage: 'preview', parsed }))
    } catch (e) {
      setState(s => ({ ...s, stage: 'error', error: String(e) }))
    }
  }, [])

  const setSubject = useCallback((subject: string) => {
    subjectRef.current = subject
    setState(s => ({ ...s, subject }))
  }, [])

  const setFolderId = useCallback((folderId: string | undefined) => {
    folderRef.current = folderId
    setState(s => ({ ...s, folderId }))
  }, [])

  const confirmImport = useCallback(async () => {
    const parsed = parsedRef.current
    const subject = subjectRef.current
    const folderId = folderRef.current

    if (!parsed || !subject) return

    setState(s => ({
      ...s,
      stage: 'importing',
      progress: { done: 0, total: parsed.questions.length },
    }))

    try {
      const savedCount = await importExamViewQuestions(
        parsed.questions,
        parsed.allImages,
        parsed.sourceFile,
        {
          subject,
          folderId,
          onProgress: (done, total) =>
            setState(s => ({ ...s, progress: { done, total } })),
        },
      )
      setState(s => ({ ...s, stage: 'done', savedCount }))
    } catch (e) {
      setState(s => ({ ...s, stage: 'error', error: String(e) }))
    }
  }, [])

  const reset = useCallback(() => {
    parsedRef.current = null
    subjectRef.current = ''
    folderRef.current = undefined
    setState(INITIAL)
  }, [])

  return { state, pickAndParse, setSubject, setFolderId, confirmImport, reset }
}
