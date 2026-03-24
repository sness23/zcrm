import { useState } from 'react'

interface NewChannelModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateChannel: (name: string, description: string) => void
}

export default function NewChannelModal({ isOpen, onClose, onCreateChannel }: NewChannelModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = () => {
    if (name.trim()) {
      onCreateChannel(name.trim(), description.trim())
      setName('')
      setDescription('')
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Create a channel</h2>
        <p>Channels are where conversations happen around a topic.</p>

        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. engineering"
          autoFocus
        />

        <label>Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's this channel about?"
        />

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSubmit} disabled={!name.trim()} className="primary">
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
