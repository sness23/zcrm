import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
  // Panel collapse state
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean

  // Panel widths (percentages)
  leftPanelWidth: number
  rightPanelWidth: number

  // Active right tab (per party)
  activeRightTab: Record<string, string> // partyId -> tabName

  // Actions
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  setLeftPanelWidth: (width: number) => void
  setRightPanelWidth: (width: number) => void
  setActiveRightTab: (partyId: string, tabName: string) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      leftPanelWidth: 40,
      rightPanelWidth: 60,
      activeRightTab: {},

      toggleLeftPanel: () => set(state => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
      toggleRightPanel: () => set(state => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
      setLeftPanelWidth: (width) => set({ leftPanelWidth: width, rightPanelWidth: 100 - width }),
      setRightPanelWidth: (width) => set({ rightPanelWidth: width, leftPanelWidth: 100 - width }),
      setActiveRightTab: (partyId, tabName) => set(state => ({
        activeRightTab: { ...state.activeRightTab, [partyId]: tabName }
      })),
    }),
    {
      name: 'party-ui-storage',
    }
  )
)
