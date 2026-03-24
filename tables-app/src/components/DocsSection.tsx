import { useState, useEffect, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import './DocsSection.css';

interface DocsSectionProps {
  entityType: string;
  entityId: string;
}

interface DocumentData {
  path: string;
  frontmatter: Record<string, any>;
  content: string;
  last_modified: string;
  content_length: number;
}

const API_BASE_URL = 'http://localhost:9600/api';
const WS_URL = 'ws://localhost:9600';

export default function DocsSection({ entityType, entityId }: DocsSectionProps) {
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isLocalChangeRef = useRef(false);

  useEffect(() => {
    fetchDocument();
  }, [entityType, entityId]);

  const fetchDocument = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/documents/by-entity/${entityType}/${entityId}`);

      if (response.status === 404) {
        setDocument(null);
        setContent('');
        setError(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      const data = await response.json();
      setDocument(data);
      setContent(data.content);
    } catch (err) {
      console.error('Error fetching document:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!document) return;

    let ws: WebSocket | null = null;
    let mounted = true;

    // Delay WebSocket creation slightly to avoid React StrictMode double-mount issues
    const connectTimeout = setTimeout(() => {
      if (!mounted) return;

      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mounted) {
          console.log('DocsSection connected to WebSocket');
        }
      };

      ws.onmessage = async (event) => {
        if (!mounted) return;

        try {
          const data = JSON.parse(event.data);

          // Handle entity_changed events from main API server
          if (data.type === 'entity_changed' && document) {
            const currentPath = `${data.entityType}/${data.filename}`;

            // Only reload if the changed file is the one we're currently viewing
            if (currentPath === document.path) {
              // Don't reload if this was our own change
              if (isLocalChangeRef.current) {
                isLocalChangeRef.current = false;
                return;
              }

              console.log('File changed externally, reloading...');
              try {
                const response = await fetch(`${API_BASE_URL}/files/${document.path}`);
                if (response.ok) {
                  const fileData = await response.json();
                  if (mounted) {
                    setContent(fileData.content);
                  }
                }
              } catch (error) {
                console.error('Error reloading file:', error);
              }
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        if (mounted) {
          console.error('DocsSection WebSocket error:', error);
        }
      };

      ws.onclose = () => {
        if (mounted) {
          console.log('DocsSection disconnected from WebSocket');
        }
      };
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(connectTimeout);
      if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [document]);

  // Auto-save functionality
  useEffect(() => {
    if (!document || loading || !content) return;

    const timer = setTimeout(async () => {
      await handleSave();
    }, 2000); // Auto-save after 2 seconds of no typing

    return () => clearTimeout(timer);
  }, [content, document, loading]);

  const handleSave = async () => {
    if (!document || saving) return;

    setSaving(true);
    isLocalChangeRef.current = true; // Mark this as our own change
    try {
      const response = await fetch(`${API_BASE_URL}/files/${document.path}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          frontmatter: document.frontmatter
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save document');
      }

      setLastSaved(new Date());
    } catch (err) {
      console.error('Error saving document:', err);
      setError(err instanceof Error ? err.message : 'Failed to save document');
      isLocalChangeRef.current = false;
    } finally {
      setSaving(false);
    }
  };

  const openInQuip = () => {
    if (document) {
      window.open(`http://localhost:5174/?file=${document.path}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="docs-section-inline">
        <div className="detail-section">
          <h3>Notes</h3>
          <div className="section-loading">Loading document...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="docs-section-inline">
        <div className="detail-section">
          <h3>Notes</h3>
          <div className="section-error">
            <p>Error: {error}</p>
            <button onClick={fetchDocument} className="retry-button">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="docs-section-inline">
        <div className="detail-section">
          <h3>Notes</h3>
          <div className="section-empty">
            <p>No document found for this record.</p>
            <p className="empty-hint">Create one in the Docs editor to see it here.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="docs-section-inline">
      <div className="detail-section">
        <h3>Notes</h3>
        <div className="document-editor-toolbar">
          <div className="editor-title">
            <span className="editor-icon">📝</span>
            <span>{document.path.split('/').pop()?.replace('.md', '')}</span>
          </div>
          <div className="editor-status">
            {saving && <span className="status-saving">Saving...</span>}
            {!saving && lastSaved && (
              <span className="status-saved">
                Saved at {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <button onClick={openInQuip} className="edit-button">
            Open in Full Editor →
          </button>
        </div>

        <div className="document-editor-content" data-color-mode="light">
          <MDEditor
            value={content}
            onChange={(val) => setContent(val || '')}
            height={400}
            preview="live"
            hideToolbar={false}
          />
        </div>
      </div>
    </div>
  );
}
