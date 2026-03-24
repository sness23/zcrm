import { useEffect, useRef, useState, useCallback } from 'react'

interface UseWebSocketOptions {
  url: string
  onMessage?: (data: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
  autoReconnect?: boolean
  reconnectInterval?: number
}

interface WebSocketState {
  isConnected: boolean
  error: Error | null
  socketId: string | null
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  autoReconnect = true,
  reconnectInterval = 3000,
}: UseWebSocketOptions) {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    error: null,
    socketId: null,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldReconnectRef = useRef(true)

  // Store callbacks in refs to avoid recreating connect function
  const onMessageRef = useRef(onMessage)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
  }, [onMessage, onConnect, onDisconnect])

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        console.log('WebSocket connected')
        setState((prev) => ({
          ...prev,
          isConnected: true,
          error: null,
        }))
        onConnectRef.current?.()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Handle socket ID assignment
          if (data.type === 'connection' && data.socketId) {
            setState((prev) => ({
              ...prev,
              socketId: data.socketId,
            }))
          }

          onMessageRef.current?.(data)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onerror = (event) => {
        console.error('WebSocket error:', event)
        setState((prev) => ({
          ...prev,
          error: new Error('WebSocket connection error'),
        }))
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setState((prev) => ({
          ...prev,
          isConnected: false,
          socketId: null,
        }))
        onDisconnectRef.current?.()

        // Auto-reconnect if enabled
        if (autoReconnect && shouldReconnectRef.current) {
          console.log(`Reconnecting in ${reconnectInterval}ms...`)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Error creating WebSocket:', error)
      setState((prev) => ({
        ...prev,
        error: error as Error,
      }))
    }
  }, [url, autoReconnect, reconnectInterval])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
      return true
    } else {
      console.warn('WebSocket not connected, cannot send message')
      return false
    }
  }, [])

  // Connect on mount
  useEffect(() => {
    connect()

    // Cleanup on unmount
    return () => {
      shouldReconnectRef.current = false

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  return {
    ...state,
    sendMessage,
    disconnect,
    reconnect: connect,
  }
}
