import { useState, useMemo, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAuth } from '../contexts/LocalAuthContext'
import type { VaultFile } from '../types'
import './Sidebar.css'

interface SidebarProps {
  files: VaultFile[]
  selectedFile: string | null
  onFileSelect: (path: string) => void
  loading: boolean
  width: number
  onResize: (width: number) => void
  onRefresh: () => void
}

interface FlattenedFile {
  file: VaultFile
  depth: number
  isExpanded?: boolean
  hasChildren: boolean
}

export default function Sidebar({
  files,
  selectedFile,
  onFileSelect,
  loading,
  width,
  onResize,
  onRefresh,
}: SidebarProps) {
  const { user, logout } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']))
  const parentRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  // Flatten file tree for virtual list
  const flattenedFiles = useMemo(() => {
    const result: FlattenedFile[] = []
    const query = searchQuery.toLowerCase()

    const flatten = (items: VaultFile[], depth: number, parentPath: string) => {
      for (const item of items) {
        const fullPath = parentPath ? `${parentPath}/${item.name}` : item.name

        // Filter by search query
        if (query && !item.name.toLowerCase().includes(query)) {
          // But still check children
          if (item.children && item.children.length > 0) {
            flatten(item.children, depth, fullPath)
          }
          continue
        }

        const hasChildren = item.type === 'directory' && (item.children?.length || 0) > 0
        const isExpanded = expandedDirs.has(item.path)

        result.push({
          file: item,
          depth,
          isExpanded,
          hasChildren,
        })

        // Add children if directory is expanded
        if (item.type === 'directory' && isExpanded && item.children) {
          flatten(item.children, depth + 1, fullPath)
        }
      }
    }

    flatten(files, 0, '')
    return result
  }, [files, searchQuery, expandedDirs])

  // Virtual list
  const virtualizer = useVirtualizer({
    count: flattenedFiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 20,
  })

  // Toggle directory expansion
  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        onResize(e.clientX)
      }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [onResize])

  // Get file icon
  const getIcon = (file: VaultFile, isExpanded: boolean) => {
    if (file.type === 'directory') {
      return isExpanded ? '📂' : '📁'
    }
    if (file.name.endsWith('.md')) return '📝'
    if (file.name.endsWith('.json')) return '📋'
    if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) return '⚙️'
    return '📄'
  }

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-header">
        <h2>Vault</h2>
        <div className="sidebar-actions">
          <button onClick={onRefresh} title="Refresh" className="icon-button">
            🔄
          </button>
        </div>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="clear-search"
            onClick={() => setSearchQuery('')}
          >
            ×
          </button>
        )}
      </div>

      <div className="file-list" ref={parentRef}>
        {loading ? (
          <div className="loading">Loading files...</div>
        ) : flattenedFiles.length === 0 ? (
          <div className="empty">
            {searchQuery ? 'No files match your search' : 'No files in vault'}
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const { file, depth, isExpanded, hasChildren } = flattenedFiles[virtualRow.index]
              const isSelected = file.path === selectedFile
              const isDir = file.type === 'directory'

              return (
                <div
                  key={virtualRow.key}
                  className={`file-item ${isSelected ? 'selected' : ''} ${isDir ? 'directory' : ''}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingLeft: `${12 + depth * 16}px`,
                  }}
                  onClick={() => {
                    if (isDir) {
                      toggleDir(file.path)
                    } else {
                      onFileSelect(file.path)
                    }
                  }}
                >
                  {hasChildren && (
                    <span className="expand-icon">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  )}
                  <span className="file-icon">{getIcon(file, !!isExpanded)}</span>
                  <span className="file-name">{file.name}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="user-info">
          <span className="user-email">{user?.email}</span>
        </div>
        <button onClick={logout} className="logout-button">
          Sign Out
        </button>
      </div>

      {/* Resize handle */}
      <div
        className="resize-handle"
        ref={resizeRef}
        onMouseDown={handleMouseDown}
      />
    </aside>
  )
}
