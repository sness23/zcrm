import { X } from 'lucide-react'
import type { PartyTabState } from '../../store/tabStore'

interface PartyTabProps {
  tab: PartyTabState
  isActive: boolean
  onActivate: () => void
  onClose: () => void
}

export default function PartyTab({ tab, isActive, onActivate, onClose }: PartyTabProps) {
  return (
    <div
      className={`flex items-center space-x-2 px-4 py-2 rounded-t-lg border cursor-pointer transition-colors ${
        isActive
          ? 'bg-white border-gray-300 border-b-white'
          : 'bg-gray-100 border-gray-200 hover:bg-gray-200'
      }`}
      onClick={onActivate}
    >
      <span className="text-base font-medium truncate max-w-[200px]">
        {tab.partyName}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="p-1 rounded hover:bg-gray-300 transition-colors"
        aria-label={`Close ${tab.partyName} tab`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
