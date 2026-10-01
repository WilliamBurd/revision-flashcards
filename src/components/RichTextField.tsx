import { forwardRef, lazy, Suspense } from 'react'
import type { RichTextEditorHandle, RichTextEditorProps } from './RichTextEditor'
import { input } from './ui'

// The editor library only loads when a form with one opens, so the review
// screen stays quick to start.
const RichTextEditor = lazy(() => import('./RichTextEditor'))

export type { RichTextEditorHandle as RichTextFieldHandle }

/** A text box that shows bold, italics and bullets as you type. */
const RichTextField = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextField(props, ref) {
  return (
    <Suspense fallback={<div className={`${input} min-h-24`} aria-hidden="true" />}>
      <RichTextEditor ref={ref} {...props} />
    </Suspense>
  )
})

export default RichTextField
