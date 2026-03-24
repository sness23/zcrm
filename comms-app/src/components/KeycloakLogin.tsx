import { useAuth } from '../contexts/KeycloakAuthContext'
import doibioLogo from '../assets/doibio.png'

export default function KeycloakLogin() {
  const { login, register, loading } = useAuth()

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

  return (
    <div className="login-container">
      <div className="login-box">
        <img src={doibioLogo} alt="DOI.bio" className="login-logo" />
        <h1>Welcome to DOI.bio</h1>
        <p className="login-subtitle">Sign in to access your CRM</p>

        <div className="login-buttons">
          <button onClick={login} className="login-btn primary">
            Sign In
          </button>
          <button onClick={register} className="login-btn secondary">
            Create Account
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

        .login-buttons {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .login-btn {
          padding: 0.875rem 1.5rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .login-btn.primary {
          background: #4f46e5;
          color: white;
        }

        .login-btn.primary:hover {
          background: #4338ca;
        }

        .login-btn.secondary {
          background: transparent;
          color: #4f46e5;
          border: 1px solid #4f46e5;
        }

        .login-btn.secondary:hover {
          background: rgba(79, 70, 229, 0.1);
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
