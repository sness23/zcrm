import './EmailPreview.css'

interface EmailPreviewProps {
  subject: string
  bodyHtml: string
  fromName?: string
  toName?: string
  toEmail?: string
}

export default function EmailPreview({ subject, bodyHtml, fromName, toName, toEmail }: EmailPreviewProps) {
  return (
    <div className="email-preview">
      <div className="preview-header">
        <div className="preview-field">
          <span className="field-label">Subject:</span>
          <span className="field-value subject">{subject}</span>
        </div>
        {fromName && (
          <div className="preview-field">
            <span className="field-label">From:</span>
            <span className="field-value">{fromName}</span>
          </div>
        )}
        {(toName || toEmail) && (
          <div className="preview-field">
            <span className="field-label">To:</span>
            <span className="field-value">
              {toName}{toName && toEmail && ' <'}{toEmail}{toName && toEmail && '>'}
            </span>
          </div>
        )}
      </div>
      <div className="preview-body">
        <div
          className="email-content"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    </div>
  )
}
