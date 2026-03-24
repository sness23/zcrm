#!/usr/bin/env tsx
/**
 * Start All Services for Zax CRM
 * Launches API, Worker, and all UI applications
 */

import { spawn } from 'child_process';
import path from 'path';

const services = [
  {
    name: 'API Server',
    command: 'npm',
    args: ['run', 'api:dev'],
    cwd: process.cwd(),
    color: '\x1b[36m', // Cyan
    port: 9600
  },
  {
    name: 'Vault Worker',
    command: 'npm',
    args: ['run', 'worker:dev'],
    cwd: process.cwd(),
    color: '\x1b[35m', // Magenta
    port: null
  },
  {
    name: 'Comms App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'comms-app'),
    color: '\x1b[32m', // Green
    port: 9100
  },
  {
    name: 'Docs App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'docs-app'),
    color: '\x1b[33m', // Yellow
    port: 9102
  },
  {
    name: 'Tables App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'tables-app'),
    color: '\x1b[34m', // Blue
    port: 9101
  },
  {
    name: 'Login App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'login-app'),
    color: '\x1b[95m', // Bright Magenta
    port: 9103
  },
  {
    name: 'Earn App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'earn-app'),
    color: '\x1b[92m', // Bright Green
    port: 9104
  },
  {
    name: 'Leads App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'leads-app'),
    color: '\x1b[96m', // Bright Cyan
    port: 9105
  },
  {
    name: 'Search App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'search-app'),
    color: '\x1b[93m', // Bright Yellow
    port: 9106
  },
  {
    name: 'Graph App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'graph-app'),
    color: '\x1b[95m', // Bright Magenta
    port: 9007
  },
  {
    name: 'Contact App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'contact-app'),
    color: '\x1b[97m', // Bright White
    port: 9107
  },
  {
    name: 'Vid App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'vid-app'),
    color: '\x1b[91m', // Bright Red
    port: 9109
  },
  {
    name: 'ES App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'es-app'),
    color: '\x1b[35m', // Magenta
    port: 9110
  },
  {
    name: 'Email App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'email-app'),
    color: '\x1b[36m', // Cyan
    port: 9111
  },
  {
    name: 'Analytics App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'analytics-app'),
    color: '\x1b[93m', // Bright Yellow
    port: 9112
  },
  {
    name: 'Ads App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'ads-app'),
    color: '\x1b[91m', // Bright Red
    port: 9113
  },
  {
    name: 'News App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'news-app'),
    color: '\x1b[92m', // Bright Green
    port: 9008
  },
  {
    name: 'Blog App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'blog-app'),
    color: '\x1b[95m', // Bright Magenta
    port: 9114
  },
  {
    name: 'Party App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'party-app'),
    color: '\x1b[96m', // Bright Cyan
    port: 9115
  },
  {
    name: 'Obsidian App',
    command: 'npm',
    args: ['run', 'dev'],
    cwd: path.join(process.cwd(), 'obsidian-app'),
    color: '\x1b[94m', // Bright Blue
    port: 9116
  },
  {
    name: 'WWW Server',
    command: 'node',
    args: ['server.js'],
    cwd: path.join(process.cwd(), 'www'),
    color: '\x1b[37m', // White
    port: 3000
  }
];

const reset = '\x1b[0m';
const bold = '\x1b[1m';

console.log(`${bold}🚀 Starting Zax CRM Services...${reset}\n`);

const processes: any[] = [];

services.forEach((service) => {
  console.log(`${service.color}▶ Starting ${service.name}...${reset}`);

  const proc = spawn(service.command, service.args, {
    cwd: service.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  processes.push({ name: service.name, proc, color: service.color });

  // Prefix output with service name
  proc.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter((line: string) => line.trim());
    lines.forEach((line: string) => {
      console.log(`${service.color}[${service.name}]${reset} ${line}`);
    });
  });

  proc.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n').filter((line: string) => line.trim());
    lines.forEach((line: string) => {
      console.log(`${service.color}[${service.name}]${reset} ${line}`);
    });
  });

  proc.on('error', (error) => {
    console.error(`${service.color}[${service.name}] ERROR:${reset}`, error);
  });

  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${service.color}[${service.name}] Exited with code ${code}${reset}`);
    }
  });
});

// Wait a bit then print summary
setTimeout(() => {
  console.log(`\n${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`);
  console.log(`${bold}✨ All services started!${reset}\n`);

  console.log(`${bold}URLs:${reset}`);
  services.forEach((service) => {
    if (service.port) {
      console.log(`  ${service.color}●${reset} ${service.name}: ${bold}http://localhost:${service.port}${reset}`);
    }
  });

  console.log(`\n${bold}API Endpoints:${reset}`);
  console.log(`  • Health Check: http://localhost:9600/health`);
  console.log(`  • Entities: http://localhost:9600/api/entities/{type}`);
  console.log(`  • Events: http://localhost:9600/api/events`);
  console.log(`  • WebSocket: ws://localhost:9600`);

  console.log(`\n${bold}Useful Commands:${reset}`);
  console.log(`  • Seed data: npm run reseed`);
  console.log(`  • Slow seed (watch live): npm run reseed:slow`);
  console.log(`  • Reset data: npm run reset`);

  console.log(`\n${bold}Press Ctrl+C to stop all services${reset}`);
  console.log(`${bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}\n`);
}, 3000);

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(`\n\n${bold}🛑 Stopping all services...${reset}\n`);

  processes.forEach(({ name, proc, color }) => {
    console.log(`${color}■ Stopping ${name}...${reset}`);
    proc.kill('SIGTERM');
  });

  // Give processes time to clean up
  setTimeout(() => {
    processes.forEach(({ proc }) => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    });

    console.log(`\n${bold}✅ All services stopped${reset}\n`);
    process.exit(0);
  }, 1000);
});

// Keep the script running
process.stdin.resume();
