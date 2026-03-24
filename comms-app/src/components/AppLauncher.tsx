import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Database,
  FileText,
  MessageSquare,
  Table,
  Search,
  Video,
  ExternalLink,
} from 'lucide-react'
import './AppLauncher.css'

interface App {
  id: string
  name: string
  description: string
  url: string
  icon: React.ReactNode
  color: string
  status: 'active' | 'coming-soon'
}

interface AppLauncherProps {
  compactMode: boolean
}

export default function AppLauncher({ compactMode }: AppLauncherProps) {
  const docsUrl = import.meta.env.VITE_DOCS_URL || 'http://localhost:9002'
  const commsUrl = import.meta.env.VITE_COMMS_URL || 'http://localhost:9000'
  const tablesUrl = import.meta.env.VITE_TABLES_URL || 'http://localhost:9001'
  const earnUrl = import.meta.env.VITE_EARN_URL || 'http://localhost:9004'
  const leadsUrl = import.meta.env.VITE_LEADS_URL || 'http://localhost:9005'
  const searchUrl = import.meta.env.VITE_SEARCH_URL || 'http://localhost:9006'
  const wwwUrl = import.meta.env.VITE_WWW_URL || 'http://localhost:9007'

  const apps: App[] = [
    {
      id: 'comms',
      name: 'Comms',
      description: 'Real-time messaging',
      url: commsUrl,
      icon: <MessageSquare className="w-6 h-6" />,
      color: 'from-green-500 to-emerald-600',
      status: 'active',
    },
    {
      id: 'tables',
      name: 'Tables',
      description: 'CRM database',
      url: tablesUrl,
      icon: <Table className="w-6 h-6" />,
      color: 'from-violet-500 to-purple-600',
      status: 'active',
    },
    {
      id: 'docs',
      name: 'Docs',
      description: 'Document editor',
      url: docsUrl,
      icon: <FileText className="w-6 h-6" />,
      color: 'from-amber-500 to-orange-600',
      status: 'active',
    },
    {
      id: 'search',
      name: 'Search',
      description: 'Search vault',
      url: searchUrl,
      icon: <Search className="w-6 h-6" />,
      color: 'from-yellow-500 to-amber-600',
      status: 'active',
    },
    {
      id: 'leads',
      name: 'Leads',
      description: 'Leads marketplace',
      url: leadsUrl,
      icon: <ShoppingCart className="w-6 h-6" />,
      color: 'from-blue-500 to-indigo-600',
      status: 'active',
    },
    {
      id: 'earn',
      name: 'Earn',
      description: 'Lead-to-earn',
      url: earnUrl,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'from-emerald-500 to-teal-600',
      status: 'active',
    },
    {
      id: 'www',
      name: 'WWW',
      description: 'Video sharing',
      url: wwwUrl,
      icon: <Video className="w-6 h-6" />,
      color: 'from-pink-500 to-rose-600',
      status: 'active',
    },
    {
      id: 'crm',
      name: 'CRM',
      description: 'Coming soon',
      url: '#',
      icon: <Database className="w-6 h-6" />,
      color: 'from-purple-500 to-pink-600',
      status: 'coming-soon',
    },
    {
      id: 'analytics',
      name: 'Analytics',
      description: 'Coming soon',
      url: '#',
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'from-orange-500 to-red-600',
      status: 'coming-soon',
    },
  ]

  const handleAppClick = (app: App) => {
    if (app.status === 'coming-soon') return
    window.location.href = app.url
  }

  return (
    <div className={`app-launcher ${compactMode ? 'compact' : ''}`}>
      <div className={`app-launcher-grid ${compactMode ? 'compact' : ''}`}>
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => handleAppClick(app)}
            disabled={app.status === 'coming-soon'}
            title={`${app.name}${app.status === 'coming-soon' ? ' (Coming Soon)' : ''}`}
            className={`app-launcher-item ${
              app.status === 'coming-soon' ? 'coming-soon' : ''
            } ${compactMode ? 'compact' : ''}`}
          >
            <div className={`app-icon bg-gradient-${app.color}`}>
              {app.icon}
            </div>
            {!compactMode && (
              <div className="app-info">
                <div className="app-name">
                  {app.name}
                  {app.status === 'active' && (
                    <ExternalLink className="external-icon" />
                  )}
                </div>
                <div className="app-description">{app.description}</div>
                {app.status === 'coming-soon' && (
                  <div className="coming-soon-badge">Coming Soon</div>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
