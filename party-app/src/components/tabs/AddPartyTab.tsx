import { Plus } from 'lucide-react'
import { useTabStore } from '../../store/tabStore'

export default function AddPartyTab() {
  const { openTab } = useTabStore()

  const handleClick = () => {
    // TODO: Open party search/selector modal (Phase 2)
    // For now, open a demo party
    openTab({
      id: 'pty_demo_' + Date.now(),
      name: 'Demo Party',
      type: 'individual',
    })
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-200 transition-colors"
      aria-label="Add new party tab"
    >
      <Plus className="w-5 h-5 text-gray-600" />
    </button>
  )
}
