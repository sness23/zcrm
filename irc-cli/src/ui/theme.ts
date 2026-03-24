import type { Theme } from '../types/config.js';

export function loadDefaultTheme(): Theme {
  return {
    background: 'black',
    foreground: 'white',
    timestamp: 'grey',
    nick: ['cyan', 'green', 'yellow', 'blue', 'magenta'],
    channelActive: 'white on blue',
    channelInactive: 'white',
    divider: 'grey',
    statusBar: 'black on white',
    create: 'green',
    update: 'yellow',
    delete: 'red',
    error: 'red',
    success: 'green',
    pending: 'yellow'
  };
}
