import { useTabStore } from '../../store/tabStore'
import PartyTab from './PartyTab'
import AddPartyTab from './AddPartyTab'

export default function PartyTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore()

  return (
    <div className="flex items-center space-x-1 px-2 py-2 bg-gray-50 border-b border-gray-200 overflow-x-auto">
      {tabs.map(tab => (
        <PartyTab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onActivate={() => setActiveTab(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}
      <AddPartyTab />
    </div>
  )
}
