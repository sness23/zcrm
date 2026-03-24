import { useEffect } from 'react'
import { GraphViewer } from './components/GraphViewer'
import { GraphControls } from './components/GraphControls'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { useGraphStore } from './stores/graphStore'
import { webSocketService } from './services/websocket'
import './App.css'

function App() {
  const { loadGraphData, error, isLoading } = useGraphStore()

  useEffect(() => {
    // Load initial graph data
    loadGraphData()

    // Connect WebSocket for real-time updates
    webSocketService.connect()

    // Cleanup on unmount
    return () => {
      webSocketService.disconnect()
    }
  }, [])

  if (error) {
    return (
      <div className="error-container">
        <h1>Error Loading Graph</h1>
        <p>{error}</p>
        <button onClick={loadGraphData}>Retry</button>
      </div>
    )
  }

  return (
    <div className="app">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading graph data...</p>
        </div>
      )}

      <GraphViewer />
      <GraphControls />
      <NodeDetailPanel />

      <div className="app-header">
        <h1>FS-CRM Graph Visualizer</h1>
        <div className="connection-status">
          <span className={webSocketService.isConnected() ? 'connected' : 'disconnected'}>
            {webSocketService.isConnected() ? '● Connected' : '○ Disconnected'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default App