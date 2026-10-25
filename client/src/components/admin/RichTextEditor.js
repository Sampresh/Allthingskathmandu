'use client'

import { useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { clsx } from 'clsx'

const TOOLS = [
  {
    label: 'Heading 2',
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e) => e.isActive('heading', { level: 2 }),
  },
  {
    label: 'Heading 3',
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    active: (e) => e.isActive('heading', { level: 3 }),
  },
  {
    label: 'Bold',
    run: (e) => e.chain().focus().toggleBold().run(),
    active: (e) => e.isActive('bold'),
  },
  {
    label: 'Italic',
    run: (e) => e.chain().focus().toggleItalic().run(),
    active: (e) => e.isActive('italic'),
  },
  {
    label: 'Underline',
    run: (e) => e.chain().focus().toggleUnderline().run(),
    active: (e) => e.isActive('underline'),
  },
  {
    label: 'Bullet list',
    run: (e) => e.chain().focus().toggleBulletList().run(),
    active: (e) => e.isActive('bulletList'),
  },
  {
    label: 'Numbered list',
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    active: (e) => e.isActive('orderedList'),
  },
  {
    label: 'Quote',
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    active: (e) => e.isActive('blockquote'),
  },
  { label: 'Undo', run: (e) => e.chain().focus().undo().run() },
  { label: 'Redo', run: (e) => e.chain().focus().redo().run() },
]

/**
 * Tiptap editor for CMS pages. Output is sanitized again by the API on save
 * (headings, lists, links, emphasis only).
 */
export function RichTextEditor({ label, value, onChange }) {
  const [url, setUrl] = useState('')
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false } }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'cms-body min-h-64 p-3 focus:outline-none',
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  })
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? TOOLS.map((t) => (t.active ? t.active(e) : false)) : []),
  })

  if (!editor) return <div className="min-h-64 rounded-box border border-text-muted" />

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{label}</span>
      <div className="rounded-box border border-text-muted">
        <div
          role="toolbar"
          aria-label="Formatting"
          className="flex flex-wrap gap-1 border-b border-border p-1"
        >
          {TOOLS.map((tool, i) => (
            <button
              key={tool.label}
              type="button"
              aria-pressed={tool.active ? Boolean(state?.[i]) : undefined}
              onClick={() => tool.run(editor)}
              className={clsx(
                'min-h-11 rounded-box px-2 text-sm font-semibold',
                state?.[i] ? 'bg-brand text-brand-contrast' : 'hover:bg-surface-raised',
              )}
            >
              {tool.label}
            </button>
          ))}
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (url.trim())
                editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
              else editor.chain().focus().unsetLink().run()
              setUrl('')
            }}
          >
            <label className="sr-only" htmlFor="rte-link">
              Link address
            </label>
            <input
              id="rte-link"
              type="url"
              placeholder="https://… (empty removes)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="min-h-11 rounded-box border border-border bg-surface px-2 text-sm"
            />
            <button
              type="submit"
              className="min-h-11 rounded-box px-2 text-sm font-semibold hover:bg-surface-raised"
            >
              Link
            </button>
          </form>
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
