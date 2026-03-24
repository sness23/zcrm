import { useState, useEffect } from 'react'
import { getTemplates, renderEmail, createDraft, type EmailTemplate, type Party } from '../lib/api'
import RecipientPicker from './RecipientPicker'
import EmailPreview from './EmailPreview'
import './ComposeEmail.css'

interface ComposeEmailProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ComposeEmail({ onSuccess, onCancel }: ComposeEmailProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [selectedRecipients, setSelectedRecipients] = useState<Party[]>([])
  const [mergeData, setMergeData] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{ subject: string, body_html: string } | null>(null)
  const [step, setStep] = useState<'template' | 'recipients' | 'merge' | 'preview'>('template')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const data = await getTemplates()
      setTemplates(data.filter(t => t.status === 'active'))
    } catch (err) {
      console.error('Failed to fetch templates:', err)
      setError('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    // Initialize merge data with empty strings
    const fields: Record<string, string> = {}
    template.merge_fields?.forEach(f => {
      fields[f] = ''
    })
    setMergeData(fields)
    setStep('recipients')
  }

  const handleRecipientsConfirm = () => {
    if (selectedRecipients.length === 0) {
      setError('Please select at least one recipient')
      return
    }
    setError(null)

    // Pre-fill merge data from first recipient if possible
    const firstRecipient = selectedRecipients[0]
    const newMergeData = { ...mergeData }

    if (firstRecipient.name) {
      const nameParts = firstRecipient.name.split(' ')
      if (!newMergeData.first_name) newMergeData.first_name = nameParts[0] || ''
      if (!newMergeData.last_name) newMergeData.last_name = nameParts.slice(1).join(' ') || ''
      if (!newMergeData.name) newMergeData.name = firstRecipient.name
    }
    if (firstRecipient.email && !newMergeData.email) {
      newMergeData.email = firstRecipient.email
    }

    setMergeData(newMergeData)

    if (selectedTemplate?.merge_fields && selectedTemplate.merge_fields.length > 0) {
      setStep('merge')
    } else {
      handlePreview(newMergeData)
    }
  }

  const handlePreview = async (data?: Record<string, string>) => {
    if (!selectedTemplate) return

    try {
      setLoading(true)
      const rendered = await renderEmail(selectedTemplate.id, data || mergeData)
      setPreview(rendered)
      setStep('preview')
    } catch (err) {
      console.error('Failed to render preview:', err)
      setError('Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!selectedTemplate || selectedRecipients.length === 0) return

    try {
      setSending(true)
      setError(null)

      // Create draft for each recipient
      for (const recipient of selectedRecipients) {
        await createDraft({
          template_id: selectedTemplate.id,
          party_id: recipient.id,
          to_email: recipient.email!,
          to_name: recipient.name,
          merge_data: mergeData
        })
      }

      onSuccess?.()
    } catch (err: any) {
      console.error('Failed to create drafts:', err)
      setError(err.message || 'Failed to create drafts')
    } finally {
      setSending(false)
    }
  }

  const goBack = () => {
    if (step === 'recipients') {
      setStep('template')
      setSelectedTemplate(null)
    } else if (step === 'merge') {
      setStep('recipients')
    } else if (step === 'preview') {
      setStep(selectedTemplate?.merge_fields?.length ? 'merge' : 'recipients')
    }
  }

  return (
    <div className="compose-email">
      <div className="compose-header">
        <h2>
          {step === 'template' && 'Select Template'}
          {step === 'recipients' && 'Select Recipients'}
          {step === 'merge' && 'Fill Merge Fields'}
          {step === 'preview' && 'Preview & Send'}
        </h2>
        <div className="compose-nav">
          {step !== 'template' && (
            <button className="nav-btn back" onClick={goBack}>
              ← Back
            </button>
          )}
          {onCancel && (
            <button className="nav-btn cancel" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {error && <div className="compose-error">{error}</div>}

      <div className="compose-content">
        {/* Step 1: Template Selection */}
        {step === 'template' && (
          <div className="template-selection">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="empty-state">
                <p>No active templates available</p>
              </div>
            ) : (
              <div className="template-options">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="template-option"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <h3>{template.name}</h3>
                    <p className="template-subject">{template.subject}</p>
                    {template.category && (
                      <span className="template-category">{template.category}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Recipient Selection */}
        {step === 'recipients' && (
          <div className="recipient-selection">
            <div className="selected-template-summary">
              <span>Template:</span>
              <strong>{selectedTemplate?.name}</strong>
            </div>
            <RecipientPicker
              onSelect={setSelectedRecipients}
              multiple={true}
            />
            <div className="step-actions">
              <button
                className="primary-btn"
                onClick={handleRecipientsConfirm}
                disabled={selectedRecipients.length === 0}
              >
                Continue ({selectedRecipients.length} selected)
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Merge Fields */}
        {step === 'merge' && selectedTemplate?.merge_fields && (
          <div className="merge-fields-form">
            <p className="merge-hint">
              Fill in the values for merge fields. These will be used for all recipients.
            </p>
            {selectedTemplate.merge_fields.map(field => (
              <div key={field} className="merge-field-input">
                <label htmlFor={field}>{`{{${field}}}`}</label>
                <input
                  id={field}
                  type="text"
                  value={mergeData[field] || ''}
                  onChange={(e) => setMergeData({ ...mergeData, [field]: e.target.value })}
                  placeholder={`Enter ${field}...`}
                />
              </div>
            ))}
            <div className="step-actions">
              <button
                className="primary-btn"
                onClick={() => handlePreview()}
              >
                Preview Email
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preview & Send */}
        {step === 'preview' && preview && (
          <div className="preview-section">
            <div className="recipients-summary">
              <span>Sending to {selectedRecipients.length} recipient(s):</span>
              <div className="recipients-list">
                {selectedRecipients.map(r => (
                  <span key={r.id} className="recipient-chip">{r.name}</span>
                ))}
              </div>
            </div>
            <EmailPreview subject={preview.subject} bodyHtml={preview.body_html} />
            <div className="step-actions">
              <button
                className="primary-btn send"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? 'Creating Drafts...' : `Create ${selectedRecipients.length} Draft(s) in Gmail`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
