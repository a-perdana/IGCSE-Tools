import { useState, useCallback } from 'react'
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

  const pickAndParse = useCallback(async (file: File) => {
    setState(s => ({ ...s, stage: 'parsing', error: null }))
    try {
      const parsed = await parseExamViewZip(file)
      setState(s => ({ ...s, stage: 'preview', parsed }))
    } catch (e) {
      setState(s => ({ ...s, stage: 'error', error: String(e) }))
    }
  }, [])

  const setSubject = useCallback((subject: string) =>
    setState(s => ({ ...s, subject })), [])

  const setFolderId = useCallback((folderId: string | undefined) =>
    setState(s => ({ ...s, folderId })), [])

  const confirmImport = useCallback(async () => {
    setState(s => {
      if (!s.parsed || !s.subject) return s
      return { ...s, stage: 'importing', progress: { done: 0, total: s.parsed.questions.length } }
    })

    setState(prev => {
      const { parsed, subject, folderId } = prev
      if (!parsed || !subject) return prev

      importExamViewQuestions(
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
        .then(savedCount => setState(s => ({ ...s, stage: 'done', savedCount })))
        .catch(e => setState(s => ({ ...s, stage: 'error', error: String(e) })))

      return prev
    })
  }, [])

  const reset = useCallback(() => setState(INITIAL), [])

  return { state, pickAndParse, setSubject, setFolderId, confirmImport, reset }
}
