import { useState, useEffect, useRef } from 'react';
import './CommsSection.css';

interface CommsSectionProps {
  entityId: string;
  entityType: string;
}

interface Event {
  event_id: string;
  type: string;
  entity_type?: string;
  entity_id?: string;
  status: string;
  timestamp: string;
  error?: string;
  data?: {
    author?: string;
    author_name?: string;
    text?: string;
    message_type?: string;
  };
}

const API_BASE_URL = 'http://localhost:9600/api';
const WS_URL = 'ws://localhost:9600';

export default function CommsSection({ entityId, entityType }: CommsSectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when events change
  useEffect(() => {
    scrollToBottom();
  }, [events]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchEvents();
  }, [entityId]);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/events?limit=100&days=30`);

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      // Filter events for this entity
      const filtered = data.events.filter((e: Event) => e.entity_id === entityId);
      setEvents(filtered);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // WebSocket connection for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let mounted = true;

    // Delay WebSocket creation slightly to avoid React StrictMode double-mount issues
    const connectTimeout = setTimeout(() => {
      if (!mounted) return;

      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mounted) {
          console.log('CommsSection connected to WebSocket');
        }
      };

      ws.onmessage = async (event) => {
        if (!mounted) return;

        try {
          const data = JSON.parse(event.data);

          // Handle new_message events for real-time chat updates
          if (data.type === 'new_message' && data.message.entity_id === entityId) {
            // Add the new message to our events list
            setEvents(prev => [...prev, data.message]);
          }

          // Handle entity_changed events
          if (data.type === 'entity_changed') {
            // Reload events when any change happens
            fetchEvents();
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        if (mounted) {
          console.error('CommsSection WebSocket error:', error);
        }
      };

      ws.onclose = () => {
        if (mounted) {
          console.log('CommsSection disconnected from WebSocket');
        }
      };
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(connectTimeout);
      if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [entityId]);

  const sendMessage = async () => {
    if (!messageText.trim() || sending) return;

    setSending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entity_id: entityId,
          entity_type: entityType,
          text: messageText.trim(),
          author: 'user',
          author_name: 'User'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Clear input on success
      setMessageText('');

      // Refresh events to show new message (WebSocket will also update)
      fetchEvents();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getEventEmoji = (event: Event) => {
    if (event.status === 'failed') return '❌';
    if (event.status === 'pending') return '⏳';

    switch (event.type) {
      case 'create': return '✨';
      case 'update': return '✏️';
      case 'delete': return '🗑️';
      case 'bulk': return '📦';
      default: return '📝';
    }
  };

  const getEventMessage = (event: Event) => {
    const action = event.type.charAt(0).toUpperCase() + event.type.slice(1);
    const entity = event.entity_type || 'item';

    if (event.status === 'failed') {
      return `${action} ${entity} failed${event.error ? ': ' + event.error : ''}`;
    }

    return `${action} ${entity}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const groupEventsByDate = (events: Event[]) => {
    // First, sort events chronologically (oldest first)
    const sortedEvents = [...events].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const groups: { [key: string]: Event[] } = {};
    const dateOrder: string[] = [];

    sortedEvents.forEach(event => {
      const date = formatDate(event.timestamp);
      if (!groups[date]) {
        groups[date] = [];
        dateOrder.push(date);
      }
      groups[date].push(event);
    });

    // Return groups with date order preserved (oldest date first)
    const orderedGroups: { [key: string]: Event[] } = {};
    dateOrder.forEach(date => {
      orderedGroups[date] = groups[date];
    });

    return orderedGroups;
  };

  const openInSlack = () => {
    window.open(`http://localhost:5173/?channel=${entityId}`, '_blank');
  };

  const eventGroups = groupEventsByDate(events);

  if (loading) {
    return (
      <div className="slack-section-inline">
        <div className="detail-section">
          <h3>Activity Feed</h3>
          <div className="section-loading">Loading activity...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="slack-section-inline">
        <div className="detail-section">
          <h3>Activity Feed</h3>
          <div className="section-error">
            <p>Error: {error}</p>
            <button onClick={fetchEvents} className="retry-button">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="slack-section-inline">
      <div className="detail-section">
        <h3>Activity Feed</h3>

        {events.length === 0 ? (
          <div className="section-empty">
            <p>No activity yet for this record.</p>
            <p className="empty-hint">Messages and updates will appear here.</p>
          </div>
        ) : (
          <>
            <div className="events-container">
              {Object.entries(eventGroups).map(([date, dateEvents]) => (
                <div key={date}>
                  <div className="date-divider">
                    <span>{date}</span>
                  </div>

                  {dateEvents.map((event) => {
                    const isUserMessage = event.data?.message_type === 'user_message';

                    return (
                      <div
                        key={event.event_id}
                        className={`event-message ${event.status === 'failed' ? 'error' : ''} ${isUserMessage ? 'user-message' : ''}`}
                      >
                        <div className="event-avatar">
                          <span className="avatar-emoji">{isUserMessage ? '👤' : getEventEmoji(event)}</span>
                        </div>
                        <div className="event-content">
                          <div className="event-header">
                            <span className="event-author">
                              {isUserMessage ? (
                                event.data?.author_name || 'User'
                              ) : (
                                <>
                                  {event.type === 'create' && 'System Created'}
                                  {event.type === 'update' && 'System Updated'}
                                  {event.type === 'delete' && 'System Deleted'}
                                  {event.type === 'bulk' && 'System Bulk Operation'}
                                </>
                              )}
                            </span>
                            <span className="event-time">{formatTime(event.timestamp)}</span>
                          </div>
                          <div className="event-text">
                            {isUserMessage ? event.data?.text : getEventMessage(event)}
                          </div>
                          {!isUserMessage && (
                            <div className="event-meta">
                              <span className={`status-badge status-${event.status}`}>
                                {event.status}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            <div className="events-footer">
              <span className="events-count">
                {events.length} message{events.length !== 1 ? 's' : ''}
              </span>
              <button onClick={openInSlack} className="view-button">
                View in Slack →
              </button>
            </div>
          </>
        )}

        {/* Chat input */}
        <div className="message-input-container">
          <textarea
            className="message-input"
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            rows={1}
          />
          <button
            className="send-button"
            onClick={sendMessage}
            disabled={!messageText.trim() || sending}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
