import React from 'react'
import { BookOpen, Sparkles } from 'lucide-react'

/** Footer rendered inside scroll containers so it appears right after content,
 *  with no empty white-space gap between the last item and the bottom of the page. */
export function PageFooter() {
  return (
    <footer className="mt-8 border-t border-stone-100 pt-3 pb-2 flex items-center justify-between text-xs text-stone-400 select-none">
      <div className="flex items-center gap-2">
        <BookOpen className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span className="font-medium text-stone-500">IGCSE Tools</span>
        <span className="hidden sm:inline text-stone-300">·</span>
        <span className="hidden sm:inline">Cambridge Assessment Designer</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-violet-400" />
          AI-Powered
        </span>
        <span className="text-stone-300">·</span>
        <span>© {new Date().getFullYear()} Eduversal</span>
      </div>
    </footer>
  )
}
