import { useState, useEffect } from 'react'
import confetti from 'canvas-confetti'
import './ContactForm.css'

interface ContactFormProps {
  onSubmit: (data: ContactFormData) => void | Promise<void>
  onFieldChange?: (field: string, value: string) => void
  onFieldEnter?: (field: string, value: string) => void
  isConnected: boolean
  isSubmitted?: boolean
}

export interface ContactFormData {
  phone?: string
  email?: string
  name?: string
  company?: string
  message?: string
  isFullSubmission?: boolean // Flag to indicate Send Message button was clicked
}

export function ContactForm({ onSubmit, onFieldChange, onFieldEnter, isConnected, isSubmitted = false }: ContactFormProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    phone: '',
    email: '',
    name: '',
    company: '',
    message: '',
  })
  const [hasSubmittedPhone, setHasSubmittedPhone] = useState(false)

  // Trigger massive confetti effect when form is submitted
  useEffect(() => {
    if (isSubmitted) {
      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min
      }

      // Initial celebration - EXTRA SPECTACULAR!
      const duration = 5000 // Longer duration for more celebration
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 25, spread: 360, ticks: 80, zIndex: 9999 } // Slower fall

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 80 * (timeLeft / duration) // More particles!

        // Fire confetti from LOTS of positions across the screen
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.4, 0.6), y: Math.random() - 0.2 }
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        })
        // Add extra explosions for maximum celebration!
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.2, 0.4), y: Math.random() - 0.1 }
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.6, 0.8), y: Math.random() - 0.1 }
        })
      }, 150) // Fire more frequently (every 150ms instead of 250ms)

      // After initial celebration ends, start periodic mini bursts
      const scheduleNextBurst = () => {
        // Random delay between 5-15 seconds (2x more frequent!)
        const delay = randomInRange(5, 15) * 1000

        return setTimeout(() => {
          // Mini confetti burst - 3x bigger!
          const miniDefaults = { startVelocity: 25, spread: 180, ticks: 70, zIndex: 9999 }

          // Fire bursts from multiple positions for bigger effect
          confetti({
            ...miniDefaults,
            particleCount: 90,
            origin: { x: randomInRange(0.3, 0.5), y: Math.random() - 0.1 }
          })
          confetti({
            ...miniDefaults,
            particleCount: 90,
            origin: { x: randomInRange(0.5, 0.7), y: Math.random() - 0.1 }
          })

          // Schedule the next burst
          currentTimeout = scheduleNextBurst()
        }, delay)
      }

      // Start periodic bursts after initial celebration
      let currentTimeout = setTimeout(() => {
        currentTimeout = scheduleNextBurst()
      }, duration)

      return () => {
        clearInterval(interval)
        clearTimeout(currentTimeout)
      }
    }
  }, [isSubmitted])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    // Notify parent of field change (debounced by user typing)
    if (value && onFieldChange) {
      onFieldChange(name, value)
    }
  }

  const handlePhoneBlur = () => {
    if (formData.phone && formData.phone.length >= 10 && !hasSubmittedPhone) {
      // Trigger instant iMessage when phone number is entered
      onSubmit({ phone: formData.phone })
      setHasSubmittedPhone(true)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate that at least phone OR email is provided
    const hasValidPhone = formData.phone && formData.phone.replace(/\D/g, '').length >= 10
    const hasValidEmail = formData.email && formData.email.includes('@')

    if (!hasValidPhone && !hasValidEmail) {
      alert('Please enter either a phone number or email address')
      return
    }

    // Submit full contact information
    const dataToSubmit: ContactFormData = {
      isFullSubmission: true // Flag that Send Message button was clicked
    }

    if (formData.phone) dataToSubmit.phone = formData.phone
    if (formData.email) dataToSubmit.email = formData.email
    if (formData.name) dataToSubmit.name = formData.name
    if (formData.company) dataToSubmit.company = formData.company
    if (formData.message) dataToSubmit.message = formData.message

    onSubmit(dataToSubmit)
  }

  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const phoneNumber = value.replace(/\D/g, '')

    // Format as (XXX) XXX-XXXX
    if (phoneNumber.length <= 3) {
      return phoneNumber
    } else if (phoneNumber.length <= 6) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
    } else {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setFormData((prev) => ({ ...prev, phone: formatted }))

    // Notify parent of phone field change
    if (formatted && onFieldChange) {
      onFieldChange('phone', formatted)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, fieldName: string) => {
    console.log('🔑 Key pressed:', e.key, 'field:', fieldName)
    if (e.key === 'Enter' && onFieldEnter) {
      const value = (e.target as HTMLInputElement | HTMLTextAreaElement).value
      console.log('⏎ Enter key detected! Calling onFieldEnter with:', fieldName, value)
      if (value.trim()) {
        onFieldEnter(fieldName, value)
      } else {
        console.log('⏎ Value is empty, not calling onFieldEnter')
      }
    }
  }

  // Show Thank You message if submitted
  if (isSubmitted) {
    return (
      <div className="contact-form thank-you-message">
        <div className="thank-you-content">
          <h1 className="thank-you-title">Thank You!</h1>
          <p className="thank-you-text">
            We've received your information and will get back to you shortly.
          </p>
          <div className="thank-you-icon">🎉</div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      <div className="form-header">
        <h2>Get in touch.</h2>
        <p className="form-subtext">Share your contact info and we'll reach out to you.</p>
      </div>

      <div className="form-group">
        <label htmlFor="phone">
          Phone Number
          {hasSubmittedPhone && (
            <span className="label-hint"> ✓ Text sent!</span>
          )}
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handlePhoneChange}
          onBlur={handlePhoneBlur}
          onKeyDown={(e) => handleKeyDown(e, 'phone')}
          placeholder="(555) 123-4567"
          disabled={!isConnected}
        />
        <p className="field-hint">
          Enter your number to receive an instant text message
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          onKeyDown={(e) => handleKeyDown(e, 'email')}
          placeholder="you@example.com"
          disabled={!isConnected}
        />
        <p className="field-hint">
          * At least phone or email is required
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="name">Name</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          onKeyDown={(e) => handleKeyDown(e, 'name')}
          placeholder="Jane Doe"
          disabled={!isConnected}
        />
      </div>

      <div className="form-group">
        <label htmlFor="company">Company</label>
        <input
          type="text"
          id="company"
          name="company"
          value={formData.company}
          onChange={handleChange}
          onKeyDown={(e) => handleKeyDown(e, 'company')}
          placeholder="Acme Corp"
          disabled={!isConnected}
        />
      </div>

      <div className="form-group">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder="Tell us how we can help..."
          rows={4}
          disabled={!isConnected}
        />
      </div>

      <button type="submit" className="submit-button" disabled={!isConnected}>
        {isConnected ? 'Send Message' : 'Connecting...'}
      </button>

      {!isConnected && (
        <p className="connection-status">
          Establishing secure connection...
        </p>
      )}
    </form>
  )
}
