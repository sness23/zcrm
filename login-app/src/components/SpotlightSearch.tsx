import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, ArrowRight } from 'lucide-react'

interface App {
  id: string
  name: string
  description: string
  url: string
  icon: React.ReactNode
  color: string
  status: 'active' | 'coming-soon'
}

interface SpotlightSearchProps {
  isOpen: boolean
  onClose: () => void
  apps: App[]
  onSelectApp: (app: App) => void
}

export default function SpotlightSearch({ isOpen, onClose, apps, onSelectApp }: SpotlightSearchProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter apps based on query
  const filteredApps = apps.filter(app => {
    if (!query.trim()) return true
    const searchLower = query.toLowerCase()
    return (
      app.name.toLowerCase().includes(searchLower) ||
      app.description.toLowerCase().includes(searchLower)
    )
  }).filter(app => app.status === 'active')

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredApps.length > 0) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex, filteredApps.length])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < filteredApps.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredApps.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filteredApps[selectedIndex]) {
          onSelectApp(filteredApps[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) {
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredApps.length - 1
          )
        } else {
          setSelectedIndex(prev =>
            prev < filteredApps.length - 1 ? prev + 1 : 0
          )
        }
        break
    }
  }, [filteredApps, selectedIndex, onSelectApp, onClose])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-xl bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Search apps"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-700">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search apps..."
            className="flex-1 bg-transparent text-white text-lg placeholder-gray-500 outline-none"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 bg-gray-800 rounded border border-gray-700">
            esc
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto"
          role="listbox"
        >
          {filteredApps.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No apps found for "{query}"
            </div>
          ) : (
            filteredApps.map((app, index) => (
              <button
                key={app.id}
                onClick={() => onSelectApp(app)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-indigo-600/30 border-l-2 border-indigo-500'
                    : 'hover:bg-gray-800/50 border-l-2 border-transparent'
                }`}
                role="option"
                aria-selected={index === selectedIndex}
              >
                {/* App Icon */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br ${app.color} flex items-center justify-center text-white`}
                >
                  {app.icon}
                </div>

                {/* App Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">{app.name}</div>
                  <div className="text-sm text-gray-400 truncate">{app.description}</div>
                </div>

                {/* Arrow indicator for selected */}
                {index === selectedIndex && (
                  <ArrowRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer with hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-700 bg-gray-800/50 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">↓</kbd>
              <span className="ml-1">navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">↵</kbd>
              <span className="ml-1">open</span>
            </span>
          </div>
          <span>{filteredApps.length} app{filteredApps.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}
