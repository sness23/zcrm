import { ChevronRight } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import HighlightsPanel from '../highlights/HighlightsPanel'
import ProfilePanel from '../profile/ProfilePanel'
import ContactPointsPanel from '../contact-points/ContactPointsPanel'
import { ScholarView } from '../scholar/ScholarView'

interface RightPanelProps {
  partyId: string
  onCollapse: () => void
}

const TABS = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'profile', label: 'Profile' },
  { id: 'contact-points', label: 'Contact Points' },
  { id: 'research', label: 'Research' },
  { id: 'relationships', label: 'Relationships' },
]

export default function RightPanel({ partyId, onCollapse }: RightPanelProps) {
  const { activeRightTab, setActiveRightTab } = useUIStore()
  const activeTab = activeRightTab[partyId] || 'highlights'

  return (
    <div className="h-full flex flex-col bg-black/40 backdrop-blur-sm">
      {/* Header with Tabs */}
      <div className="border-b border-purple-900/50 bg-purple-950/20">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex space-x-4 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveRightTab(partyId, tab.id)}
                className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                    : 'text-gray-300 hover:text-white hover:bg-purple-900/30'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={onCollapse}
            className="p-1 rounded hover:bg-purple-900/30 ml-2 flex-shrink-0 text-gray-300 hover:text-white"
            aria-label="Collapse right panel"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'highlights' && <HighlightsPanel partyId={partyId} />}
        {activeTab === 'profile' && <ProfilePanel partyId={partyId} />}
        {activeTab === 'contact-points' && <ContactPointsPanel partyId={partyId} />}
        {activeTab === 'research' && <ScholarView partyId={partyId} />}
        {activeTab === 'relationships' && (
          <div className="p-4">
            <h3 className="text-xl font-semibold mb-4 text-white">Relationships</h3>
            <p className="text-gray-300">Relationships (Phase 5)</p>
          </div>
        )}
      </div>
    </div>
  )
}
