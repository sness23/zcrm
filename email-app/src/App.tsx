import { useState } from 'react'
import GmailConnect from './components/GmailConnect'
import TemplateList from './components/TemplateList'
import TemplateEditor from './components/TemplateEditor'
import ComposeEmail from './components/ComposeEmail'
import DraftList from './components/DraftList'
import doibioLogo from './assets/doibio.png'
import './App.css'

import type { EmailTemplate } from './lib/api'

type View = 'dashboard' | 'templates' | 'compose' | 'drafts' | 'editor'

function App() {
  const [view, setView] = useState<View>('dashboard')
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

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

  const handleTemplateEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setView('editor')
  }

  const handleTemplateCreate = () => {
    setEditingTemplate(null)
    setView('editor')
  }

  const handleTemplateSaved = () => {
    setEditingTemplate(null)
    setView('templates')
  }

  const handleComposeSuccess = () => {
    setView('drafts')
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <a href={getLoginUrl()} className="logo-link" title="Go to App Launcher">
              <img src={doibioLogo} alt="doi.bio Logo" className="app-logo" />
            </a>
            <div className="header-text">
              <h1>email</h1>
              <div className="header-subtitle">Email campaigns with Gmail</div>
            </div>
          </div>
          <div className="header-right">
            <nav className="main-nav">
              <button
                className={`nav-tab ${view === 'dashboard' ? 'active' : ''}`}
                onClick={() => setView('dashboard')}
              >
                Dashboard
              </button>
              <button
                className={`nav-tab ${view === 'templates' || view === 'editor' ? 'active' : ''}`}
                onClick={() => setView('templates')}
              >
                Templates
              </button>
              <button
                className={`nav-tab ${view === 'compose' ? 'active' : ''}`}
                onClick={() => setView('compose')}
              >
                Compose
              </button>
              <button
                className={`nav-tab ${view === 'drafts' ? 'active' : ''}`}
                onClick={() => setView('drafts')}
              >
                Drafts
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Dashboard View */}
        {view === 'dashboard' && (
          <div className="dashboard">
            <GmailConnect />

            <div className="dashboard-grid">
              <div className="dashboard-card">
                <div className="card-header">
                  <h3>📝 Templates</h3>
                  <button className="card-action" onClick={() => setView('templates')}>
                    View All →
                  </button>
                </div>
                <p>Create and manage email templates with merge fields</p>
                <button className="primary-btn" onClick={handleTemplateCreate}>
                  + New Template
                </button>
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <h3>✉️ Compose</h3>
                  <button className="card-action" onClick={() => setView('compose')}>
                    Start →
                  </button>
                </div>
                <p>Select a template, pick recipients, and create Gmail drafts</p>
                <button className="primary-btn" onClick={() => setView('compose')}>
                  Compose Email
                </button>
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <h3>📤 Drafts</h3>
                  <button className="card-action" onClick={() => setView('drafts')}>
                    View All →
                  </button>
                </div>
                <p>View and manage your created Gmail drafts</p>
                <button className="primary-btn" onClick={() => setView('drafts')}>
                  View Drafts
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Templates View */}
        {view === 'templates' && (
          <TemplateList
            onSelect={(template) => handleTemplateEdit(template)}
            onEdit={handleTemplateEdit}
            onCreate={handleTemplateCreate}
          />
        )}

        {/* Template Editor View */}
        {view === 'editor' && (
          <TemplateEditor
            template={editingTemplate}
            onSave={handleTemplateSaved}
            onCancel={() => setView('templates')}
          />
        )}

        {/* Compose View */}
        {view === 'compose' && (
          <ComposeEmail
            onSuccess={handleComposeSuccess}
            onCancel={() => setView('dashboard')}
          />
        )}

        {/* Drafts View */}
        {view === 'drafts' && (
          <DraftList />
        )}
      </main>
    </div>
  )
}

export default App
