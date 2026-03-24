import { useUIStore } from '../../store/uiStore'
import LeftPanel from './LeftPanel'
import RightPanel from './RightPanel'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PartyLayoutProps {
  partyId: string
  onBack?: () => void
}

export default function PartyLayout({ partyId, onBack }: PartyLayoutProps) {
  const {
    leftPanelCollapsed,
    rightPanelCollapsed,
    leftPanelWidth,
    toggleLeftPanel,
    toggleRightPanel,
  } = useUIStore()

  return (
    <div className="flex h-full overflow-hidden">
        {/* Left Panel */}
        <div
        className={`panel border-r border-purple-900/50 transition-all duration-300 ${
          leftPanelCollapsed ? 'w-12' : ''
        }`}
        style={{ width: leftPanelCollapsed ? '48px' : `${leftPanelWidth}%` }}
      >
        {leftPanelCollapsed ? (
          <button
            onClick={toggleLeftPanel}
            className="w-full h-full flex items-center justify-center hover:bg-purple-900/30 bg-black/40 backdrop-blur-sm text-gray-300 hover:text-white transition-colors"
            aria-label="Expand left panel"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        ) : (
          <LeftPanel partyId={partyId} onCollapse={toggleLeftPanel} onBack={onBack} />
        )}
      </div>

      {/* Right Panel */}
      <div
        className={`panel transition-all duration-300 ${
          rightPanelCollapsed ? 'w-12' : ''
        }`}
        style={{ width: rightPanelCollapsed ? '48px' : `${100 - leftPanelWidth}%` }}
      >
        {rightPanelCollapsed ? (
          <button
            onClick={toggleRightPanel}
            className="w-full h-full flex items-center justify-center hover:bg-purple-900/30 bg-black/40 backdrop-blur-sm text-gray-300 hover:text-white transition-colors"
            aria-label="Expand right panel"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <RightPanel partyId={partyId} onCollapse={toggleRightPanel} />
        )}
      </div>
    </div>
  )
}
