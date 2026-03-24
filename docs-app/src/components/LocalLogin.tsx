import { useState } from 'react'
import { useAuth } from '../contexts/LocalAuthContext'
import doibioLogo from '../assets/doibio.png'

export default function LocalLogin() {
  const { login, register, loading } = useAuth()
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-box">
          <img src={doibioLogo} alt="DOI.bio" className="login-logo" />
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      let result
      if (isRegister) {
        result = await register(email, password, name || undefined)
      } else {
        result = await login(email, password)
      }

      if (result.error) {
        setError(result.error)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <img src={doibioLogo} alt="DOI.bio" className="login-logo" />
        <h1>{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
        <p className="login-subtitle">
          {isRegister ? 'Sign up to get started' : 'Sign in to access your CRM'}
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn primary" disabled={submitting}>
            {submitting ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="login-toggle">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister)
              setError('')
            }}
            className="toggle-btn"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>

        <div className="login-info">
          <p>Demo credentials:</p>
          <code>demo@doi.bio / demo123</code>
        </div>
      </div>

      <style>{`
        .login-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        }

        .login-box {
          background: #1e1e2e;
          border-radius: 12px;
          padding: 3rem;
          max-width: 400px;
          width: 90%;
          text-align: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .login-logo {
          width: 80px;
          height: 80px;
          margin-bottom: 1.5rem;
        }

        .login-box h1 {
          color: #fff;
          margin: 0 0 0.5rem;
          font-size: 1.75rem;
        }

        .login-subtitle {
          color: #888;
          margin-bottom: 2rem;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          text-align: left;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          color: #aaa;
          font-size: 0.875rem;
        }

        .form-group input {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border: 1px solid #333;
          background: #2a2a3e;
          color: #fff;
          font-size: 1rem;
        }

        .form-group input:focus {
          outline: none;
          border-color: #4f46e5;
        }

        .form-group input::placeholder {
          color: #666;
        }

        .error-message {
          color: #ef4444;
          font-size: 0.875rem;
          padding: 0.5rem;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 4px;
        }

        .login-btn {
          padding: 0.875rem 1.5rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          margin-top: 0.5rem;
        }

        .login-btn.primary {
          background: #4f46e5;
          color: white;
        }

        .login-btn.primary:hover:not(:disabled) {
          background: #4338ca;
        }

        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-toggle {
          margin-top: 1.5rem;
        }

        .toggle-btn {
          background: none;
          border: none;
          color: #4f46e5;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .toggle-btn:hover {
          text-decoration: underline;
        }

        .login-info {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #333;
          color: #666;
          font-size: 0.875rem;
        }

        .login-info code {
          display: block;
          margin-top: 0.5rem;
          color: #888;
          font-family: monospace;
        }

        .loading-spinner {
          color: #888;
          padding: 2rem;
        }
      `}</style>
    </div>
  )
}
