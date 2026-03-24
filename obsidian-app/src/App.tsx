import { useState, useEffect, useCallback } from 'react'
import { AuthProvider, useAuth } from './contexts/LocalAuthContext'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import type { VaultFile } from './types'
import './App.css'

const API_BASE_URL = 'http://localhost:9500/api'

function AppContent() {
  const { user, loading: authLoading } = useAuth()
  const [files, setFiles] = useState<VaultFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(280)

  // Load vault files
  const loadFiles = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/vault/files`)
      if (!response.ok) throw new Error('Failed to load files')
      const data = await response.json()
      setFiles(data)
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // Load file content when selected
  const handleFileSelect = useCallback(async (path: string) => {
    setSelectedFile(path)
    try {
      const response = await fetch(`${API_BASE_URL}/vault/file?path=${encodeURIComponent(path)}`)
      if (!response.ok) throw new Error('Failed to load file')
      const data = await response.json()
      setFileContent(data.content)
    } catch (error) {
      console.error('Error loading file:', error)
      setFileContent('')
    }
  }, [])

  // Save file content
  const handleSave = useCallback(async (content: string) => {
    if (!selectedFile) return
    setSaving(true)
    try {
      await fetch(`${API_BASE_URL}/vault/file`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile, content })
      })
    } catch (error) {
      console.error('Error saving file:', error)
    } finally {
      setSaving(false)
    }
  }, [selectedFile])

  // Navigate to wikilink target
  const handleWikilinkClick = useCallback((link: string) => {
    // Parse wikilink: [[folder/file]] or [[file]]
    const target = link.replace(/^\[\[|\]\]$/g, '')

    // Try to find matching file
    const matchingFile = files.find(f => {
      const baseName = f.path.replace(/\.md$/, '')
      return baseName === target || baseName.endsWith(`/${target}`)
    })

    if (matchingFile) {
      handleFileSelect(matchingFile.path)
    } else {
      console.log('File not found:', target)
    }
  }, [files, handleFileSelect])

  // Handle sidebar resize
  const handleSidebarResize = useCallback((width: number) => {
    setSidebarWidth(Math.max(200, Math.min(500, width)))
  }, [])

  if (authLoading) {
    return (
      <div className="app loading">
        <div className="loading-spinner">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="app">
      <Sidebar
        files={files}
        selectedFile={selectedFile}
        onFileSelect={handleFileSelect}
        loading={loading}
        width={sidebarWidth}
        onResize={handleSidebarResize}
        onRefresh={loadFiles}
      />
      <main className="main-content">
        {selectedFile ? (
          <Editor
            content={fileContent}
            filePath={selectedFile}
            onChange={setFileContent}
            onSave={handleSave}
            onWikilinkClick={handleWikilinkClick}
            saving={saving}
            files={files}
          />
        ) : (
          <div className="empty-state">
            <h2>No file selected</h2>
            <p>Select a file from the sidebar to start editing</p>
          </div>
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
