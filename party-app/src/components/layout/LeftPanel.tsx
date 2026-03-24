import { ChevronLeft, ArrowLeft } from 'lucide-react'

interface LeftPanelProps {
  partyId: string
  onCollapse: () => void
  onBack?: () => void
}

export default function LeftPanel({ partyId, onCollapse, onBack }: LeftPanelProps) {
  return (
    <div className="h-full flex flex-col bg-black/40 backdrop-blur-sm">
      {/* Back Button */}
      {onBack && (
        <div className="border-b border-purple-900/50 px-4 py-2 bg-purple-950/20">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-200 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Party List</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-purple-900/50 bg-purple-950/20">
        <h2 className="text-lg font-semibold text-white">History</h2>
        <button
          onClick={onCollapse}
          className="p-1 rounded hover:bg-purple-900/30 text-gray-300 hover:text-white"
          aria-label="Collapse left panel"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Unified History Content (Phase 3) */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-gray-300">History content will go here (Phase 3)</p>
        <p className="text-sm text-gray-400 mt-2">Party ID: {partyId}</p>
      </div>

      {/* Chat Input (Phase 3) */}
      <div className="p-4 border-t border-purple-900/50 bg-purple-950/20">
        <input
          type="text"
          placeholder="Type a message..."
          className="w-full px-4 py-2 bg-black/40 border border-purple-800/50 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-400 backdrop-blur-sm"
          disabled
        />
      </div>
    </div>
  )
}
