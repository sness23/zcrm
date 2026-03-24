import { useState } from 'react'
import './App.css'
import { ContactForm, type ContactFormData } from './components/ContactForm'
import { ChatWidget } from './components/ChatWidget'
import { useWebSocket } from './hooks/useWebSocket'
import doibioLogo from './assets/doibio.png'

interface Message {
  id: string
  author: 'visitor' | 'admin' | 'system'
  author_name: string
  text: string
  timestamp: string
}

function App() {
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isFormSubmitted, setIsFormSubmitted] = useState(false)

  const { isConnected, sendMessage } = useWebSocket({
    url: 'ws://localhost:9600?client=visitor',
    onMessage: (data) => {
      console.log('Received message:', data)

      // Handle different message types
      if (data.type === 'connection') {
        // Store sessionId when connection is established
        setSessionId(data.sessionId)
        console.log('Session established:', data.sessionId)
      } else if (data.type === 'update:success') {
        console.log('Visitor data updated successfully')
      } else if (data.type === 'message:sent') {
        console.log('Chat message sent successfully')
      } else if (data.type === 'admin:message') {
        // Admin sent a message - add to chat and auto-open widget
        setChatMessages(prev => [...prev, data.message])
        setChatOpen(true)
      }
    },
    onConnect: () => {
      console.log('Connected to server')
      // Don't auto-open chat - wait for admin to send first message
    },
    onDisconnect: () => {
      console.log('Disconnected from server')
    },
  })

  const handleFormSubmit = async (formData: ContactFormData) => {
    console.log('Form submitted:', formData)

    // Send visitor update via WebSocket
    const success = sendMessage({
      type: 'visitor:update',
      data: formData,
    })

    if (!success) {
      console.error('Failed to send message - not connected')
    }

    // Only trigger confetti/thank you when Send Message button is clicked
    // (not for phone blur event which sends without the flag)
    if (formData.isFullSubmission) {
      setIsFormSubmitted(true)
      // Scroll to top to show thank you message
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // If phone number is provided, send notification to #general channel
    if (formData.phone) {
      try {
        const timestamp = new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })

        const adminLink = sessionId
          ? `http://local.comms.doi.bio/?visitor=${sessionId}`
          : 'http://local.comms.doi.bio'

        const message = `📞 **New Contact Request**
Phone: ${formData.phone}${formData.name ? `\nName: ${formData.name}` : ''}${formData.email ? `\nEmail: ${formData.email}` : ''}${formData.company ? `\nCompany: ${formData.company}` : ''}${formData.message ? `\nMessage: ${formData.message}` : ''}
Time: ${timestamp}
🔗 [View Visitor](${adminLink})`

        const response = await fetch('http://localhost:9600/api/channels/ch_general/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: message,
            author: 'system',
            author_name: 'Contact Form',
          }),
        })

        if (response.ok) {
          console.log('✅ Notification sent to #general channel')
        } else {
          console.error('Failed to send notification to #general:', await response.text())
        }
      } catch (error) {
        console.error('Error sending notification to #general:', error)
      }
    }
  }

  const handleSendChatMessage = (text: string) => {
    // Optimistically add the message to the chat immediately
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      author: 'visitor',
      author_name: 'You',
      text,
      timestamp: new Date().toISOString()
    }
    setChatMessages(prev => [...prev, newMessage])

    // Send to backend
    sendMessage({
      type: 'visitor:message',
      text
    })
  }

  const handleFieldChange = (field: string, value: string) => {
    // Send activity message to backend
    const fieldLabels: Record<string, string> = {
      phone: 'phone number',
      email: 'email',
      name: 'name',
      company: 'company',
      message: 'message'
    }

    const activityText = `Entered ${fieldLabels[field]}: ${value}`

    sendMessage({
      type: 'visitor:activity',
      field,
      value,
      text: activityText
    })

    // Add activity message to local chat (marked as system so it's hidden in chat widget)
    const activityMsg: Message = {
      id: `msg_${Date.now()}`,
      author: 'system',
      author_name: 'System',
      text: activityText,
      timestamp: new Date().toISOString()
    }
    setChatMessages(prev => [...prev, activityMsg])
  }

  const handleFieldEnter = async (field: string, value: string) => {
    // When user presses Enter, immediately update their visitor session
    // This makes them appear in the Contacts list right away
    const updateData: Record<string, string> = {}
    updateData[field] = value

    sendMessage({
      type: 'visitor:update',
      data: updateData
    })

    // If phone field, also send notification to #general
    if (field === 'phone' && value) {
      console.log('🔔 Sending notification to #general for phone:', value, 'sessionId:', sessionId)

      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })

      const adminLink = sessionId
        ? `http://local.comms.doi.bio/?visitor=${sessionId}`
        : 'http://local.comms.doi.bio'

      const message = `📞 **New Contact Request**
Phone: ${value}
Time: ${timestamp}
🔗 [View Visitor](${adminLink})`

      console.log('🔔 Notification message:', message)

      try {
        const response = await fetch('http://localhost:9600/api/channels/ch_general/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: message,
            author: 'system',
            author_name: 'Contact Form',
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log('✅ Notification sent to #general channel, response:', data)
        } else {
          console.error('❌ Failed to send notification, status:', response.status, await response.text())
        }
      } catch (error) {
        console.error('❌ Error sending notification to #general:', error)
      }
    }
  }

  return (
    <div className="app">
      <div className="contact-container">
        <div className="form-section">
          <ContactForm
            onSubmit={handleFormSubmit}
            onFieldChange={handleFieldChange}
            onFieldEnter={handleFieldEnter}
            isConnected={isConnected}
            isSubmitted={isFormSubmitted}
          />
        </div>

        <div className="info-section">
          <div className="info-card">
            <div className="logo-container">
              <img src={doibioLogo} alt="doi.bio" className="logo" />
            </div>
            <h1>Contact Us</h1>
            <p className="subtitle">Let's start a conversation</p>

            <h3>Get in Touch</h3>
            <p className="info-description">
              We're here to help and answer any questions you might have.
            </p>

            <div className="contact-methods">
              <div className="contact-method">
                <div className="method-icon">📞</div>
                <div className="method-details">
                  <div className="method-label">Call us</div>
                  <a href="tel:+15555551234" className="method-value">
                    1-555-555-1234
                  </a>
                </div>
              </div>

              <div className="contact-method">
                <div className="method-icon">✉️</div>
                <div className="method-details">
                  <div className="method-label">Email us</div>
                  <a href="mailto:hello@example.com" className="method-value">
                    hello@example.com
                  </a>
                </div>
              </div>

              <div className="contact-method">
                <div className="method-icon">💬</div>
                <div className="method-details">
                  <div className="method-label">Live Chat</div>
                  <div className="method-value status-indicator">
                    <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
                    {isConnected ? 'Online' : 'Connecting...'}
                  </div>
                </div>
              </div>
            </div>

            <div className="additional-info">
              <h4>Business Hours</h4>
              <p>Monday - Friday: 9:00 AM - 6:00 PM PST</p>
              <p>Saturday - Sunday: Closed</p>
            </div>
          </div>
        </div>
      </div>

      <ChatWidget
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        onSendMessage={handleSendChatMessage}
        isConnected={isConnected}
      />
    </div>
  )
}

export default App
