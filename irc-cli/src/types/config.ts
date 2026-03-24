export interface Theme {
  background: string;
  foreground: string;
  timestamp: string;
  nick: string[];
  channelActive: string;
  channelInactive: string;
  divider: string;
  statusBar: string;
  create: string;
  update: string;
  delete: string;
  error: string;
  success: string;
  pending: string;
}

export interface AppConfig {
  // Display settings
  theme: string;
  show_timestamps: boolean;
  show_event_ids: boolean;
  timestamp_format: string;
  date_format: string;

  // Behavior
  auto_scroll: boolean;
  notification_sound: boolean;
  poll_interval: number;
  max_buffer_size: number;

  // Data sources
  api_url: string;
  vault_path: string;
  watch_logs: boolean;
  use_database: boolean;

  // Pinned channels
  pinned: string[];

  // Aliases
  aliases: Record<string, string>;

  // Window settings
  sidebar_width: number;
  sidebar_visible: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  theme: 'default',
  show_timestamps: true,
  show_event_ids: true,
  timestamp_format: 'HH:mm',
  date_format: 'MMM DD',

  auto_scroll: true,
  notification_sound: false,
  poll_interval: 5000,
  max_buffer_size: 1000,

  api_url: 'http://localhost:9600',
  vault_path: './vault',
  watch_logs: true,
  use_database: false,

  pinned: [],

  aliases: {
    j: 'join',
    i: 'info',
    s: 'search',
    q: 'quit'
  },

  sidebar_width: 25,
  sidebar_visible: true
};
