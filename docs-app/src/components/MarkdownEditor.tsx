import { useState, useEffect, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import PropertiesPanel from './PropertiesPanel';
import type { FileContent } from '../types';

interface MarkdownEditorProps {
  filePath: string | null;
  onSave: (path: string, content: string, frontmatter: Record<string, any>) => Promise<void>;
  onEntityInfo: (id: string | null, type: string | null) => void;
}

const API_BASE_URL = 'http://localhost:9600/api';
const WS_URL = 'ws://localhost:9600';

export default function MarkdownEditor({ filePath, onSave, onEntityInfo }: MarkdownEditorProps) {
  const [content, setContent] = useState('');
  const [frontmatter, setFrontmatter] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const isLocalChangeRef = useRef(false);
  const isClosingRef = useRef(false);

  // Load file content when filePath changes
  useEffect(() => {
    if (!filePath) {
      setContent('');
      setFrontmatter({});
      onEntityInfo(null, null);
      return;
    }

    const loadFile = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/files/${filePath}`);
        if (!response.ok) {
          throw new Error('Failed to load file');
        }
        const data: FileContent = await response.json();
        setContent(data.content);
        setFrontmatter(data.frontmatter);

        // Pass entity info to parent
        const entityId = data.frontmatter?.id || null;
        const entityType = data.frontmatter?.type || null;
        onEntityInfo(entityId, entityType);
      } catch (error) {
        console.error('Error loading file:', error);
        alert('Failed to load file');
        onEntityInfo(null, null);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath, onEntityInfo]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    isClosingRef.current = false;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket');
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      // Handle entity_changed events from main API server
      if (data.type === 'entity_changed' && filePath) {
        const currentPath = `${data.entityType}/${data.filename}`;

        // Only reload if the changed file is the one we're currently editing
        if (currentPath === filePath) {
          // Don't reload if this was our own change
          if (isLocalChangeRef.current) {
            console.log('Ignoring our own save event');
            return;
          }

          console.log('File changed externally, reloading...');
          try {
            const response = await fetch(`${API_BASE_URL}/files/${filePath}`);
            if (response.ok) {
              const fileData: FileContent = await response.json();
              setContent(fileData.content);
              setFrontmatter(fileData.frontmatter);

              // Update entity info when file reloads
              const entityId = fileData.frontmatter?.id || null;
              const entityType = fileData.frontmatter?.type || null;
              onEntityInfo(entityId, entityType);
            }
          } catch (error) {
            console.error('Error reloading file:', error);
          }
        }
      }
    };

    ws.onerror = (error) => {
      // Suppress errors from intentional closures (React Strict Mode cleanup)
      if (!isClosingRef.current) {
        console.error('WebSocket error:', error);
      }
    };

    ws.onclose = () => {
      // Only log disconnection if it wasn't intentional
      if (!isClosingRef.current) {
        console.log('Disconnected from WebSocket');
      }
    };

    return () => {
      isClosingRef.current = true;
      ws.close();
    };
  }, [filePath]);

  // Auto-save functionality
  useEffect(() => {
    if (!filePath || loading) return;

    const timer = setTimeout(async () => {
      await handleSave();
    }, 2000); // Auto-save after 2 seconds of no typing

    return () => clearTimeout(timer);
  }, [content, frontmatter, filePath, loading]);

  const handleSave = async () => {
    if (!filePath || saving) return;

    setSaving(true);
    isLocalChangeRef.current = true; // Mark this as our own change
    try {
      await onSave(filePath, content, frontmatter);
      setLastSaved(new Date());

      // Keep the flag set for a bit longer to catch delayed WebSocket events
      setTimeout(() => {
        isLocalChangeRef.current = false;
      }, 3000); // Reset after 3 seconds (longer than auto-save delay)
    } catch (error) {
      console.error('Error saving file:', error);
      isLocalChangeRef.current = false;
    } finally {
      setSaving(false);
    }
  };

  const handlePropertiesUpdate = (updatedFrontmatter: Record<string, any>) => {
    setFrontmatter(updatedFrontmatter);
    // Auto-save will trigger from the useEffect that watches content/frontmatter
  };

  if (!filePath) {
    return (
      <div className="editor-placeholder">
        <div className="placeholder-content">
          <h2>Select a document to edit</h2>
          <p>Choose a file from the sidebar to begin editing</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="editor-placeholder">
        <div className="placeholder-content">
          <p>Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="markdown-editor">
      <div className="editor-toolbar">
        <div className="editor-title">
          <span className="icon">📝</span>
          <span>{filePath.split('/').pop()?.replace('.md', '')}</span>
        </div>
        <div className="editor-status">
          <button
            className="properties-toggle"
            onClick={() => setShowProperties(!showProperties)}
            title={showProperties ? 'Hide properties' : 'Show properties'}
          >
            {showProperties ? '▼' : '▶'}
          </button>
          <button
            className="toolbar-toggle"
            onClick={() => setShowToolbar(!showToolbar)}
            title={showToolbar ? 'Hide toolbar' : 'Show toolbar'}
          >
            {showToolbar ? '🔽' : '🔼'}
          </button>
          {saving && <span className="status-saving">Saving...</span>}
          {!saving && lastSaved && (
            <span className="status-saved">
              Saved at {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      <PropertiesPanel
        frontmatter={frontmatter}
        onUpdate={handlePropertiesUpdate}
        isCollapsed={!showProperties}
      />
      <div className="editor-content" data-color-mode="light">
        <MDEditor
          value={content}
          onChange={(val) => setContent(val || '')}
          height="100%"
          preview="edit"
          hideToolbar={!showToolbar}
        />
      </div>
    </div>
  );
}
