// The Front and Back boxes: a small Tiptap editor that only knows bold,
// italics and bullet lists. It reads and writes the stored card text format
// (see notes/format.ts), so plain text goes in and comes out unchanged.
//
// The B / I / • bar sits above each box on a computer. On a phone it floats
// just above the keyboard while you type, within thumb reach.

import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import HardBreak from '@tiptap/extension-hard-break'
import Italic from '@tiptap/extension-italic'
import { BulletList, ListItem } from '@tiptap/extension-list'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Extension } from '@tiptap/core'
import { Placeholder, UndoRedo } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { docToText, textToDoc, type PMNode } from '../notes/format'

export interface RichTextEditorProps {
  value: string
  onChange: (text: string) => void
  /** Ctrl/Cmd+Enter inside the box. */
  onSubmit?: () => void
  /** id of the visible label, for screen readers. */
  labelledBy: string
  placeholder?: string
  autoFocus?: boolean
  /** Taller box, e.g. for the Back of a card. */
  minRows?: number
}

export interface RichTextEditorHandle {
  focus: () => void
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, onSubmit, labelledBy, placeholder, autoFocus, minRows = 3 },
  ref,
) {
  // The text this editor last reported, so outside changes (the form
  // clearing after "Add card") can be told apart from typing.
  const lastText = useRef(value)
  const submit = useRef(onSubmit)
  submit.current = onSubmit
  const [focused, setFocused] = useState(false)

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      BulletList,
      ListItem,
      HardBreak,
      UndoRedo,
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      Extension.create({
        name: 'submitShortcut',
        priority: 1000,
        addKeyboardShortcuts: () => ({
          'Mod-Enter': () => {
            submit.current?.()
            return true
          },
        }),
      }),
    ],
    content: textToDoc(value),
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': labelledBy,
        class: 'rich-input',
        style: `min-height: ${minRows * 1.75 + 1.5}rem`,
      },
    },
    onUpdate: ({ editor }) => {
      const text = docToText(editor.getJSON() as PMNode)
      lastText.current = text
      onChange(text)
    },
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  })

  useEffect(() => {
    if (!editor || value === lastText.current) return
    lastText.current = value
    editor.commands.setContent(textToDoc(value), { emitUpdate: false })
  }, [editor, value])

  useImperativeHandle(ref, () => ({ focus: () => editor?.commands.focus('end') }), [editor])

  const touch = useCoarsePointer()
  if (!editor) return null
  return (
    <div className="rich-field rounded-btn border border-line bg-surface focus-within:border-accent">
      {!touch && <FormatBar editor={editor} className="border-b border-line" />}
      <EditorContent editor={editor} />
      {touch && focused && <FloatingBar editor={editor} />}
    </div>
  )
})

export default RichTextEditor

function useCoarsePointer(): boolean {
  const [coarse] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
  return coarse
}

/** On a phone: a bar pinned just above the on-screen keyboard. */
function FloatingBar({ editor }: { editor: Editor }) {
  const [bottom, setBottom] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    // The keyboard covers the bottom of the layout; visualViewport is what's left.
    const place = () => setBottom(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    place()
    vv.addEventListener('resize', place)
    vv.addEventListener('scroll', place)
    return () => {
      vv.removeEventListener('resize', place)
      vv.removeEventListener('scroll', place)
    }
  }, [])
  // Inside a dialog (editing mid-review), the bar must live in the dialog too,
  // or it would sit underneath it.
  const host = (editor.view.dom.closest('dialog') as HTMLElement | null) ?? document.body
  return createPortal(
    <div className="fixed inset-x-0 z-50 border-t border-line bg-surface shadow-[0_-4px_16px_rgb(0_0_0/0.08)]" style={{ bottom }}>
      <FormatBar editor={editor} className="mx-auto max-w-2xl px-2" />
    </div>,
    host,
  )
}

function FormatBar({ editor, className = '' }: { editor: Editor; className?: string }) {
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      list: editor.isActive('bulletList'),
    }),
  })
  return (
    <div role="toolbar" aria-label="Formatting" className={`flex items-center gap-1 py-1 ${className}`}>
      <BarButton label="Bold" shortcut="Ctrl+B" on={active.bold} run={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-extrabold">B</span>
      </BarButton>
      <BarButton label="Italics" shortcut="Ctrl+I" on={active.italic} run={() => editor.chain().focus().toggleItalic().run()}>
        <span className="font-serif text-lg italic">I</span>
      </BarButton>
      <BarButton label="Bullet list" on={active.list} run={() => editor.chain().focus().toggleBulletList().run()}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="5" cy="7" r="1.2" fill="currentColor" />
          <circle cx="5" cy="12" r="1.2" fill="currentColor" />
          <circle cx="5" cy="17" r="1.2" fill="currentColor" />
          <path d="M9.5 7H20M9.5 12H20M9.5 17H20" />
        </svg>
      </BarButton>
    </div>
  )
}

function BarButton(props: { label: string; shortcut?: string; on: boolean; run: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.on}
      title={props.shortcut ? `${props.label} (${props.shortcut})` : props.label}
      // Not a Tab stop, so Tab still goes straight from Front to Back.
      tabIndex={-1}
      // Keep the cursor in the text box: a normal tap would take focus away.
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
      onClick={props.run}
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-btn px-2 text-base ${
        props.on ? 'bg-accent-soft text-on-accent-soft' : 'text-muted hover:bg-raised hover:text-ink'
      }`}
    >
      {props.children}
    </button>
  )
}
