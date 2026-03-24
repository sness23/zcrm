import { useState, useEffect } from 'react'
import { getTemplates, type EmailTemplate } from '../lib/api'
import './TemplateList.css'

interface TemplateListProps {
  onSelect?: (template: EmailTemplate) => void
  onEdit?: (template: EmailTemplate) => void
  onCreate?: () => void
}

export default function TemplateList({ onSelect, onEdit, onCreate }: TemplateListProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const data = await getTemplates()
      setTemplates(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch templates:', err)
      setError('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const getCategoryBadge = (category?: string) => {
    const badges: Record<string, string> = {
      onboarding: '🚀',
      followup: '🔄',
      newsletter: '📰',
      outreach: '👋',
      welcome: '🎉'
    }
    return badges[category?.toLowerCase() || ''] || '📧'
  }

  if (loading) {
    return (
      <div className="template-list loading">
        <div className="spinner"></div>
        <p>Loading templates...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="template-list error">
        <p>{error}</p>
        <button onClick={fetchTemplates}>Retry</button>
      </div>
    )
  }

  return (
    <div className="template-list">
      <div className="template-list-header">
        <h2>Email Templates</h2>
        {onCreate && (
          <button className="create-template-btn" onClick={onCreate}>
            + New Template
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="template-empty">
          <div className="empty-icon">📝</div>
          <h3>No templates yet</h3>
          <p>Create your first email template to get started</p>
          {onCreate && (
            <button className="create-template-btn" onClick={onCreate}>
              Create Template
            </button>
          )}
        </div>
      ) : (
        <div className="template-grid">
          {templates.map(template => (
            <div
              key={template.id}
              className="template-card"
              onClick={() => onSelect?.(template)}
            >
              <div className="template-card-header">
                <span className="template-badge">{getCategoryBadge(template.category)}</span>
                <span className="template-category">{template.category || 'General'}</span>
              </div>
              <h3 className="template-name">{template.name}</h3>
              <p className="template-subject">{template.subject}</p>
              {template.merge_fields && template.merge_fields.length > 0 && (
                <div className="template-merge-fields">
                  {template.merge_fields.map(field => (
                    <span key={field} className="merge-field-tag">
                      {`{{${field}}}`}
                    </span>
                  ))}
                </div>
              )}
              <div className="template-card-footer">
                <span className="template-status" data-status={template.status}>
                  {template.status}
                </span>
                {onEdit && (
                  <button
                    className="template-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(template)
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
