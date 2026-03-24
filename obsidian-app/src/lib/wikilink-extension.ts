import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import type { VaultFile } from '../types'

// Decoration for wikilinks
const wikilinkMark = Decoration.mark({ class: 'cm-wikilink' })

// Find all wikilinks in the document
function findWikilinks(view: EditorView): { from: number; to: number; link: string }[] {
  const wikilinks: { from: number; to: number; link: string }[] = []
  const text = view.state.doc.toString()
  const regex = /\[\[([^\]]+)\]\]/g
  let match

  while ((match = regex.exec(text)) !== null) {
    wikilinks.push({
      from: match.index,
      to: match.index + match[0].length,
      link: match[0],
    })
  }

  return wikilinks
}

// Create decorations for wikilinks
function wikilinkDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const wikilinks = findWikilinks(view)

  for (const { from, to } of wikilinks) {
    builder.add(from, to, wikilinkMark)
  }

  return builder.finish()
}

// Plugin to highlight wikilinks
export const wikilinkHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = wikilinkDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = wikilinkDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

// Theme for wikilinks
export const wikilinkTheme = EditorView.baseTheme({
  '.cm-wikilink': {
    color: '#a78bfa',
    textDecoration: 'none',
    cursor: 'pointer',
    borderRadius: '3px',
    padding: '0 2px',
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
  },
  '.cm-wikilink:hover': {
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    textDecoration: 'underline',
  },
})

// Click handler for wikilinks
export function wikilinkClickHandler(onClick: (link: string) => void) {
  return EditorView.domEventHandlers({
    click: (event, view) => {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) return false

      const wikilinks = findWikilinks(view)
      for (const wikilink of wikilinks) {
        if (pos >= wikilink.from && pos <= wikilink.to) {
          // Ctrl/Cmd + click to follow link
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            onClick(wikilink.link)
            return true
          }
        }
      }
      return false
    },
  })
}

// Autocomplete for wikilinks
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'

export function wikilinkAutocomplete(files: VaultFile[]) {
  return autocompletion({
    override: [
      (context: CompletionContext): CompletionResult | null => {
        // Check if we're inside [[ ]]
        const before = context.matchBefore(/\[\[[^\]]*/)
        if (!before) return null

        const searchText = before.text.slice(2).toLowerCase()

        const options = files
          .filter((f) => f.type === 'file' && f.path.endsWith('.md'))
          .filter((f) => {
            const name = f.path.replace(/\.md$/, '').toLowerCase()
            return name.includes(searchText)
          })
          .slice(0, 20) // Limit results
          .map((f) => {
            const displayName = f.path.replace(/\.md$/, '')
            return {
              label: displayName,
              apply: `[[${displayName}]]`,
              type: 'file',
            }
          })

        return {
          from: before.from,
          options,
          validFor: /^[^\]]*$/,
        }
      },
    ],
  })
}

// Combined wikilink extension
export function wikilinkExtension(
  onClick: (link: string) => void,
  files: VaultFile[]
) {
  return [
    wikilinkHighlighter,
    wikilinkTheme,
    wikilinkClickHandler(onClick),
    wikilinkAutocomplete(files),
  ]
}
