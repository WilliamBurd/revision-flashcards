// Card text formatting.
//
// Card text is stored as plain text with a few simple marks, so plain text
// always works and nothing else can sneak in:
//   **bold**   _italics_ (or *italics*)   a line starting "- " is a bullet
// A backslash keeps a symbol as typed (\* is a star, not bold or italics).
// Cloze notes also use {{answer}} or {{answer::hint}} for blanks (see cloze.ts).
//
// The editor (RichTextEditor.tsx) edits a Tiptap document, so this file also
// converts between that document and the stored text.

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold' | 'italic'; children: Inline[] }
  | { type: 'cloze'; index: number; answer: string; hint: string }

export type Block =
  | { type: 'paragraph'; lines: Inline[][] }
  | { type: 'list'; items: Inline[][] }

const BULLET = /^\s*[-•]\s+/
const ESCAPABLE = '\\*_{}-•'

/** Split stored text into paragraphs and bullet lists. */
export function parseBlocks(text: string, cloze = false): Block[] {
  const counter = { n: 0 }
  const blocks: Block[] = []
  let para: Inline[][] = []
  let list: Inline[][] = []
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', lines: para })
    para = []
  }
  const flushList = () => {
    if (list.length) blocks.push({ type: 'list', items: list })
    list = []
  }
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (BULLET.test(line)) {
      flushPara()
      list.push(parseInline(line.replace(BULLET, ''), cloze, counter))
    } else if (line.trim() === '') {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(parseInline(line, cloze, counter))
    }
  }
  flushPara()
  flushList()
  return blocks
}

/** Parse one line's bold, italics and (for cloze notes) blanks. */
export function parseInline(s: string, cloze = false, counter = { n: 0 }): Inline[] {
  const out: Inline[] = []
  let buf = ''
  const flush = () => {
    if (buf) out.push({ type: 'text', text: buf })
    buf = ''
  }
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length && ESCAPABLE.includes(s[i + 1])) {
      buf += s[i + 1]
      i += 2
      continue
    }
    if (cloze && s.startsWith('{{', i)) {
      const end = s.indexOf('}}', i + 2)
      const inner = end > 0 ? s.slice(i + 2, end) : ''
      const { answer, hint } = splitBlank(inner)
      if (answer) {
        flush()
        out.push({ type: 'cloze', index: ++counter.n, answer, hint })
        i = end + 2
        continue
      }
    }
    if (s.startsWith('**', i) && isOpening(s, i + 2)) {
      const end = findClose(s, i + 2, true)
      if (end > 0) {
        flush()
        out.push({ type: 'bold', children: parseInline(s.slice(i + 2, end), cloze, counter) })
        i = end + 2
        continue
      }
    }
    if (c === '*' && s[i + 1] !== '*' && isOpening(s, i + 1)) {
      const end = findClose(s, i + 1, false)
      if (end > 0) {
        flush()
        out.push({ type: 'italic', children: parseInline(s.slice(i + 1, end), cloze, counter) })
        i = end + 1
        continue
      }
    }
    // _italics_, but not the underscores inside snake_case words.
    if (c === '_' && !isWordChar(s[i - 1]) && isOpening(s, i + 1) && s[i + 1] !== '_') {
      const end = findUnderscoreClose(s, i + 1)
      if (end > 0) {
        flush()
        out.push({ type: 'italic', children: parseInline(s.slice(i + 1, end), cloze, counter) })
        i = end + 1
        continue
      }
    }
    buf += c
    i++
  }
  flush()
  return out
}

/** "1688::year" → answer "1688", hint "year". */
export function splitBlank(inner: string): { answer: string; hint: string } {
  const at = inner.indexOf('::')
  const answer = (at >= 0 ? inner.slice(0, at) : inner).trim()
  const hint = at >= 0 ? inner.slice(at + 2).trim() : ''
  return { answer, hint }
}

/** A mark only opens when text follows it straight away ("5 * 3" isn't italics). */
function isOpening(s: string, at: number): boolean {
  return at < s.length && !/\s/.test(s[at])
}

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c)

/** Find the closing ** (double) or * (single), which must follow text, not a space. */
function findClose(s: string, from: number, double: boolean): number {
  let k = from + 1
  while (k < s.length) {
    if (s[k] === '\\') {
      k += 2
      continue
    }
    if (s[k] === '*') {
      const run = s.slice(k).match(/^\*+/)![0].length
      const afterText = !/\s/.test(s[k - 1])
      // In "***", a bold closes on the last two stars.
      if (double && run >= 2 && afterText) return k + run - 2
      if (!double && run === 1 && afterText) return k
      k += run
      continue
    }
    k++
  }
  return -1
}

function findUnderscoreClose(s: string, from: number): number {
  for (let k = from + 1; k < s.length; k++) {
    if (s[k] === '\\') {
      k++
      continue
    }
    if (s[k] === '_' && !/\s/.test(s[k - 1]) && !isWordChar(s[k + 1])) return k
  }
  return -1
}

/** Card text without any marks, for searching and short previews. */
export function toPlain(text: string): string {
  const flat = (inl: Inline[]): string =>
    inl.map((n) => (n.type === 'text' ? n.text : n.type === 'cloze' ? n.answer : flat(n.children))).join('')
  return parseBlocks(text, true)
    .map((b) => (b.type === 'paragraph' ? b.lines.map(flat).join(' ') : b.items.map(flat).join(' ')))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---- Tiptap documents ----

interface PMMark {
  type: string
}
export interface PMNode {
  type: string
  text?: string
  marks?: PMMark[]
  content?: PMNode[]
}

function inlineToNodes(inl: Inline[], marks: string[] = []): PMNode[] {
  const out: PMNode[] = []
  for (const n of inl) {
    if (n.type === 'text') {
      out.push(marks.length ? { type: 'text', text: n.text, marks: marks.map((type) => ({ type })) } : { type: 'text', text: n.text })
    } else if (n.type === 'cloze') {
      // Only cloze sentences have blanks, and those aren't edited in Tiptap.
      out.push({ type: 'text', text: n.answer })
    } else {
      out.push(...inlineToNodes(n.children, [...marks, n.type]))
    }
  }
  return out
}

const para = (inl: Inline[]): PMNode => {
  const content = inlineToNodes(inl)
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

/** Stored text → Tiptap document. Each line is a paragraph. */
export function textToDoc(text: string): PMNode {
  const content: PMNode[] = []
  let list: PMNode[] = []
  const flushList = () => {
    if (list.length) content.push({ type: 'bulletList', content: list })
    list = []
  }
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (const line of lines) {
    if (BULLET.test(line)) {
      list.push({ type: 'listItem', content: [para(parseInline(line.replace(BULLET, '')))] })
    } else {
      flushList()
      content.push(para(parseInline(line)))
    }
  }
  flushList()
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

/** Tiptap document → stored text. */
export function docToText(doc: PMNode): string {
  const lines: string[] = []
  for (const block of doc.content ?? []) {
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      for (const item of block.content ?? []) {
        // A list item may hold several paragraphs; join them with a space.
        const text = (item.content ?? []).map((p) => inlineText(p.content ?? [])).join(' ')
        lines.push(`- ${text}`)
      }
    } else {
      lines.push(inlineText(block.content ?? []))
    }
  }
  // Drop empty lines at the end (an empty editor is an empty string).
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  return lines.join('\n')
}

const ORDER = ['bold', 'italic'] as const

function escapeText(t: string): string {
  return t.replace(/[\\*_{}]/g, (c) => `\\${c}`)
}

/** One paragraph's text nodes → stored text, keeping marks well nested. */
function inlineText(nodes: PMNode[]): string {
  // Split each node into leading space, marked core and trailing space, so
  // marks never start or end on a space ("**bold **" wouldn't read back).
  const pieces: { text: string; marks: string[] }[] = []
  for (const n of nodes) {
    if (n.type === 'hardBreak') {
      pieces.push({ text: '\n', marks: [] })
      continue
    }
    if (n.type !== 'text' || !n.text) continue
    const marks = ORDER.filter((m) => n.marks?.some((x) => x.type === m))
    const [, lead, core, trail] = n.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!
    if (lead) pieces.push({ text: lead, marks: [] })
    if (core) pieces.push({ text: core, marks })
    if (trail) pieces.push({ text: trail, marks: [] })
  }
  // A space between two pieces keeps the marks both sides share, so
  // "**Glorious** **Revolution**" is written as "**Glorious Revolution**".
  const shared = (x: string[] = [], y: string[] = []) => {
    let k = 0
    while (k < x.length && k < y.length && x[k] === y[k]) k++
    return x.slice(0, k)
  }
  pieces.forEach((p, i) => {
    if (p.text !== '\n' && !p.text.trim()) p.marks = shared(pieces[i - 1]?.marks, pieces[i + 1]?.marks)
  })

  type Token = { kind: 'text'; text: string } | { kind: 'open' | 'close'; mark: string; pair: number }
  const tokens: Token[] = []
  const stack: { mark: string; pair: number }[] = []
  let pairs = 0
  for (const p of pieces) {
    const keep = shared(
      stack.map((x) => x.mark),
      p.marks,
    ).length
    while (stack.length > keep) tokens.push({ kind: 'close', ...stack.pop()! })
    for (const mark of p.marks.slice(keep)) {
      const entry = { mark, pair: pairs++ }
      stack.push(entry)
      tokens.push({ kind: 'open', ...entry })
    }
    tokens.push({ kind: 'text', text: p.text === '\n' ? '\n' : escapeText(p.text) })
  }
  while (stack.length) tokens.push({ kind: 'close', ...stack.pop()! })

  // Italics are written _like this_, except inside a word ("a*b*c"), where
  // underscores wouldn't be read back.
  const textAround = (i: number, dir: 1 | -1) => {
    for (let k = i + dir; k >= 0 && k < tokens.length; k += dir) {
      const t = tokens[k]
      if (t.kind === 'text') return dir === 1 ? t.text[0] : t.text[t.text.length - 1]
    }
    return undefined
  }
  const starItalic = new Set<number>()
  tokens.forEach((t, i) => {
    if (t.kind === 'open' && t.mark === 'italic' && isWordChar(textAround(i, -1))) starItalic.add(t.pair)
    if (t.kind === 'close' && t.mark === 'italic' && isWordChar(textAround(i, 1))) starItalic.add(t.pair)
  })
  const out = tokens
    .map((t) => (t.kind === 'text' ? t.text : t.mark === 'bold' ? '**' : starItalic.has(t.pair) ? '*' : '_'))
    .join('')
  // A plain line that starts like a bullet would turn into one.
  return out
    .split('\n')
    .map((l) => (BULLET.test(l) ? l.replace(/^(\s*)([-•])/, '$1\\$2') : l))
    .join('\n')
}
