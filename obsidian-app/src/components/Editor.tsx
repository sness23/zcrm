import { useEffect, useRef, useCallback, useMemo } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { wikilinkExtension } from '../lib/wikilink-extension'
import type { VaultFile } from '../types'
import './Editor.css'

interface EditorProps {
  content: string
  filePath: string
  onChange: (content: string) => void
  onSave: (content: string) => void
  onWikilinkClick: (link: string) => void
  saving: boolean
  files: VaultFile[]
}

// Dark theme for the editor
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e1e',
    color: '#cccccc',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, "Liberation Mono", monospace',
    fontSize: '14px',
    lineHeight: '1.6',
    padding: '16px 0',
    caretColor: '#fff',
  },
  '.cm-cursor': {
    borderLeftColor: '#fff',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#fff',
  },
  '.cm-gutters': {
    backgroundColor: '#1e1e1e',
    color: '#6e6e6e',
    border: 'none',
    paddingRight: '8px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#2d2d2d',
  },
  '.cm-activeLine': {
    backgroundColor: '#2d2d2d44',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#264f78 !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: '#264f78 !important',
  },
  '.cm-line': {
    padding: '0 16px',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  // Markdown specific styling
  '.cm-header-1': { fontSize: '1.8em', fontWeight: 'bold', color: '#e0e0e0' },
  '.cm-header-2': { fontSize: '1.5em', fontWeight: 'bold', color: '#e0e0e0' },
  '.cm-header-3': { fontSize: '1.3em', fontWeight: 'bold', color: '#e0e0e0' },
  '.cm-header-4': { fontSize: '1.1em', fontWeight: 'bold', color: '#e0e0e0' },
  '.cm-strong': { fontWeight: 'bold' },
  '.cm-em': { fontStyle: 'italic' },
  '.cm-link': { color: '#7c3aed', textDecoration: 'underline' },
  '.cm-url': { color: '#6b7280' },
  '.cm-quote': { color: '#9ca3af', fontStyle: 'italic' },
  '.cm-list': { color: '#a78bfa' },
  // Autocomplete dropdown
  '.cm-tooltip': {
    backgroundColor: '#252526',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
  },
  '.cm-tooltip-autocomplete': {
    '& > ul': {
      fontFamily: 'inherit',
      maxHeight: '300px',
    },
    '& > ul > li': {
      padding: '4px 8px',
      color: '#cccccc',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: '#094771',
      color: '#ffffff',
    },
  },
}, { dark: true })

export default function Editor({
  content,
  filePath,
  onChange,
  onSave,
  onWikilinkClick,
  saving,
  files,
}: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const contentRef = useRef(content)
  const autoSaveTimeoutRef = useRef<number | null>(null)

  // Update content ref when prop changes
  contentRef.current = content

  // Save handler with debounce
  const handleChange = useCallback((newContent: string) => {
    onChange(newContent)

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      onSave(newContent)
    }, 2000)
  }, [onChange, onSave])

  // Manual save with Ctrl/Cmd+S
  const saveExtension = useMemo(() => {
    return keymap.of([
      {
        key: 'Mod-s',
        run: (view) => {
          if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current)
          }
          onSave(view.state.doc.toString())
          return true
        },
      },
    ])
  }, [onSave])

  // Create editor
  useEffect(() => {
    if (!editorRef.current) return

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        bracketMatching(),
        history(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
        }),
        darkTheme,
        wikilinkExtension(onWikilinkClick, files),
        saveExtension,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handleChange(update.state.doc.toString())
          }
        }),
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    viewRef.current = view

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
      view.destroy()
    }
  }, [filePath]) // Recreate when file changes

  // Update content when it changes externally
  useEffect(() => {
    if (!viewRef.current) return
    const currentContent = viewRef.current.state.doc.toString()
    if (currentContent !== content) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      })
    }
  }, [content])

  const fileName = filePath.split('/').pop()?.replace('.md', '') || 'Untitled'

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="editor-title">
          <span className="file-icon">📄</span>
          <span className="file-name">{fileName}</span>
        </div>
        <div className="editor-status">
          {saving && <span className="saving-indicator">Saving...</span>}
          <span className="hint">Ctrl+Click to follow links</span>
        </div>
      </div>
      <div className="editor-content" ref={editorRef} />
    </div>
  )
}
