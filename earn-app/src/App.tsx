import './App.css'
import doibioLogo from './assets/doibio.png'

function App() {
  const getLoginUrl = () => {
    const isDev = window.location.hostname.includes('local.')
    const isLocalhost = window.location.hostname === 'localhost'
    const protocol = window.location.protocol

    if (isLocalhost) {
      return 'http://localhost:9103'
    }
    if (isDev) {
      return `${protocol}//local.login.doi.bio`
    }
    return `${protocol}//login.doi.bio`
  }

  return (
    <div className="app">
      <div className="header">
        <a href={getLoginUrl()} className="logo-link" title="Go to App Launcher">
          <img src={doibioLogo} alt="doi.bio Logo" className="header-logo" />
        </a>
        <div className="header-text">
          <h1>💰 Earn App</h1>
          <p className="subtitle">Earnings & Revenue Tracking</p>
        </div>
        <div className="info">
          <p><strong>Port:</strong> 9004</p>
          <p><strong>URL:</strong> http://local.earn.doi.bio</p>
        </div>
      </div>

      <div className="content">
        <div className="card">
          <h2>Welcome to Earn App</h2>
          <p>This is the earnings and revenue tracking interface for the CRM system.</p>
          <p>Monitor sales performance and revenue metrics here.</p>
        </div>
      </div>
    </div>
  )
}

export default App
