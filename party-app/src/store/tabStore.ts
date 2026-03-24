import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PartyTabState {
  id: string
  partyId: string
  partyName: string
  partyType: 'individual' | 'organization' | 'household'
}

interface TabStore {
  // Open tabs
  tabs: PartyTabState[]
  activeTabId: string | null

  // Recently viewed (for quick re-open)
  recentlyViewed: Array<{ partyId: string, partyName: string, timestamp: number }>

  // Actions
  openTab: (party: { id: string, name: string, type: 'individual' | 'organization' | 'household' }) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  closeAllTabs: () => void

  // Recently viewed
  addToRecentlyViewed: (partyId: string, partyName: string) => void
}

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      recentlyViewed: [],

      openTab: (party) => {
        const existingTab = get().tabs.find(t => t.partyId === party.id)

        if (existingTab) {
          // Tab already open, just activate it
          set({ activeTabId: existingTab.id })
        } else {
          // Create new tab
          const newTab: PartyTabState = {
            id: `tab_${Date.now()}`,
            partyId: party.id,
            partyName: party.name,
            partyType: party.type,
          }

          set(state => ({
            tabs: [...state.tabs, newTab],
            activeTabId: newTab.id,
          }))
        }

        // Add to recently viewed
        get().addToRecentlyViewed(party.id, party.name)
      },

      closeTab: (tabId) => {
        const tabs = get().tabs.filter(t => t.id !== tabId)
        const activeTabId = get().activeTabId

        let newActiveTabId = activeTabId

        // If closing active tab, switch to another
        if (activeTabId === tabId) {
          if (tabs.length > 0) {
            // Activate the tab to the left, or first tab
            const closedIndex = get().tabs.findIndex(t => t.id === tabId)
            const newIndex = closedIndex > 0 ? closedIndex - 1 : 0
            newActiveTabId = tabs[newIndex]?.id || null
          } else {
            newActiveTabId = null
          }
        }

        set({ tabs, activeTabId: newActiveTabId })
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId })
      },

      closeAllTabs: () => {
        set({ tabs: [], activeTabId: null })
      },

      addToRecentlyViewed: (partyId, partyName) => {
        set(state => {
          const filtered = state.recentlyViewed.filter(r => r.partyId !== partyId)
          const updated = [
            { partyId, partyName, timestamp: Date.now() },
            ...filtered,
          ].slice(0, 10) // Keep only last 10

          return { recentlyViewed: updated }
        })
      },
    }),
    {
      name: 'party-tabs-storage',
    }
  )
)
