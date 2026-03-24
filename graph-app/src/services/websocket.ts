import { useGraphStore } from '../stores/graphStore'
import { GraphNode, GraphLink } from '../types/graph'

class WebSocketService {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect() {
    try {
      // Use relative WebSocket URL to work with proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws`

      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0

        // Subscribe to graph updates
        this.send({
          type: 'subscribe',
          channel: 'graph-updates'
        })
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        this.handleReconnect()
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      this.handleReconnect()
    }
  }

  private handleMessage(data: any) {
    const store = useGraphStore.getState()

    switch (data.type) {
      case 'node-added':
        store.handleRealtimeUpdate({
          type: 'add',
          node: data.node as GraphNode
        })
        break

      case 'node-updated':
        store.handleRealtimeUpdate({
          type: 'update',
          node: data.node as GraphNode
        })
        break

      case 'node-deleted':
        store.handleRealtimeUpdate({
          type: 'delete',
          node: { id: data.nodeId } as GraphNode
        })
        break

      case 'link-added':
        store.handleRealtimeUpdate({
          type: 'add',
          link: data.link as GraphLink
        })
        break

      case 'batch-update':
        // Handle batch updates efficiently
        if (data.nodes) {
          data.nodes.forEach((node: GraphNode) => {
            store.handleRealtimeUpdate({
              type: data.operation || 'update',
              node
            })
          })
        }
        if (data.links) {
          data.links.forEach((link: GraphLink) => {
            store.handleRealtimeUpdate({
              type: data.operation || 'add',
              link
            })
          })
        }
        break

      case 'ping':
        // Respond to keep-alive ping
        this.send({ type: 'pong' })
        break

      default:
        console.log('Unknown WebSocket message type:', data.type)
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

      setTimeout(() => {
        this.connect()
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      console.error('Max reconnection attempts reached')
    }
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService()