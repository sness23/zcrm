import { useState, useEffect } from 'react'
import { createTemplate, updateTemplate, type EmailTemplate } from '../lib/api'
import './TemplateEditor.css'

interface TemplateEditorProps {
  template?: EmailTemplate | null
  onSave?: (template: EmailTemplate) => void
  onCancel?: () => void
}

export default function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [fromName, setFromName] = useState('')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!template

  useEffect(() => {
    if (template) {
      setName(template.name)
      setSubject(template.subject)
      setBody(template.body_md)
      setFromName(template.from_name || '')
      setCategory(template.category || '')
    }
  }, [template])

  // Extract merge fields from subject and body
  const extractMergeFields = (): string[] => {
    const pattern = /\{\{(\w+)\}\}/g
    const fields = new Set<string>()

    let match
    while ((match = pattern.exec(subject)) !== null) {
      fields.add(match[1])
    }
    pattern.lastIndex = 0
    while ((match = pattern.exec(body)) !== null) {
      fields.add(match[1])
    }

    return Array.from(fields)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const data = {
        name,
        subject,
        body_md: body,
        from_name: fromName || undefined,
        category: category || undefined,
        merge_fields: extractMergeFields()
      }

      let result: EmailTemplate
      if (isEditing && template) {
        result = await updateTemplate(template.id, data)
      } else {
        result = await createTemplate(data)
      }

      onSave?.(result)
    } catch (err: any) {
      setError(err.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const mergeFields = extractMergeFields()

  return (
    <div className="template-editor">
      <div className="template-editor-header">
        <h2>{isEditing ? 'Edit Template' : 'New Template'}</h2>
        {onCancel && (
          <button className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="editor-error">{error}</div>}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Template Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Welcome Email"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="category">Category</label>
            <input
              id="category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., onboarding, followup"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="fromName">From Name</label>
          <input
            id="fromName"
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="e.g., John from doi.bio"
          />
        </div>

        <div className="form-group">
          <label htmlFor="subject">Subject Line *</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Welcome, {{first_name}}!"
            required
          />
          <span className="field-hint">Use {'{{field_name}}'} for merge fields</span>
        </div>

        <div className="form-group">
          <label htmlFor="body">Email Body (Markdown) *</label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Hi {{first_name}},\n\nWelcome to doi.bio! I noticed your work on {{research_area}}...\n\nBest,\nJohn`}
            rows={12}
            required
          />
          <span className="field-hint">Supports Markdown formatting</span>
        </div>

        {mergeFields.length > 0 && (
          <div className="detected-fields">
            <span className="fields-label">Detected merge fields:</span>
            <div className="fields-list">
              {mergeFields.map(field => (
                <span key={field} className="field-tag">{`{{${field}}}`}</span>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="save-btn" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </form>
    </div>
  )
}
