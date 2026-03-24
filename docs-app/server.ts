import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { WebSocketServer } from 'ws';
import chokidar from 'chokidar';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;
const server = createServer(app);

// Path to the vault directory
const VAULT_PATH = path.join(__dirname, '..', 'vault');
const CHANGES_LOG_PATH = path.join(__dirname, '..', 'vault', 'changes.log');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Log a change to the changes log
async function logChange(action: string, filePath: string, content?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action,
    filePath,
    content: content ? (typeof content === 'string' ? content.substring(0, 100) : JSON.stringify(content).substring(0, 100)) : undefined
  };

  try {
    await fs.appendFile(
      CHANGES_LOG_PATH,
      JSON.stringify(logEntry) + '\n',
      'utf-8'
    );
  } catch (error) {
    console.error('Failed to log change:', error);
  }
}

// Get file tree structure
async function getFileTree(dirPath: string, basePath: string = dirPath): Promise<any[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const tree: any[] = [];

  for (const entry of entries) {
    // Skip hidden files and directories
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      const children = await getFileTree(fullPath, basePath);
      if (children.length > 0) {
        tree.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children
        });
      }
    } else if (entry.name.endsWith('.md')) {
      tree.push({
        name: entry.name.replace('.md', ''),
        path: relativePath,
        type: 'file'
      });
    }
  }

  return tree.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// API: Get file tree
app.get('/api/files', async (req, res) => {
  try {
    const tree = await getFileTree(VAULT_PATH);
    res.json(tree);
  } catch (error) {
    console.error('Error getting file tree:', error);
    res.status(500).json({ error: 'Failed to get file tree' });
  }
});

// API: Create new file
app.post('/api/files', async (req, res) => {
  try {
    const { path: filePath, content = '', frontmatter = {} } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const fullPath = path.join(VAULT_PATH, filePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Create file with frontmatter
    const newContent = frontmatter && Object.keys(frontmatter).length > 0
      ? matter.stringify(content, frontmatter)
      : content;

    await fs.writeFile(fullPath, newContent, 'utf-8');
    await logChange('create', filePath, content);

    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({ error: 'Failed to create file' });
  }
});

// API: Handle file operations with middleware (catch-all for /api/files/...)
app.use('/api/files', async (req, res) => {
  // Skip if it's the root /api/files request (handled above)
  if (req.path === '/' || req.path === '') {
    return res.status(404).json({ error: 'Not found' });
  }

  const filePath = req.path.substring(1); // Remove leading slash
  const fullPath = path.join(VAULT_PATH, filePath);

  try {
    if (req.method === 'GET') {
      // Get file content
      const realPath = await fs.realpath(fullPath);
      const realVaultPath = await fs.realpath(VAULT_PATH);
      if (!realPath.startsWith(realVaultPath)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const parsed = matter(content);

      await logChange('read', filePath);

      return res.json({
        path: filePath,
        frontmatter: parsed.data,
        content: parsed.content,
        raw: content
      });
    } else if (req.method === 'PUT') {
      // Update file content
      const { content, frontmatter } = req.body;

      const realPath = await fs.realpath(path.dirname(fullPath));
      const realVaultPath = await fs.realpath(VAULT_PATH);
      if (!realPath.startsWith(realVaultPath)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      let newContent: string;
      if (frontmatter && Object.keys(frontmatter).length > 0) {
        newContent = matter.stringify(content, frontmatter);
      } else {
        newContent = content;
      }

      await fs.writeFile(fullPath, newContent, 'utf-8');
      await logChange('write', filePath, content);

      return res.json({ success: true, path: filePath });
    } else if (req.method === 'DELETE') {
      // Delete file
      const realPath = await fs.realpath(fullPath);
      const realVaultPath = await fs.realpath(VAULT_PATH);
      if (!realPath.startsWith(realVaultPath)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await fs.unlink(fullPath);
      await logChange('delete', filePath);

      return res.json({ success: true, path: filePath });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error handling file operation:', error);
    return res.status(500).json({ error: 'Failed to process file operation' });
  }
});

// API: Get changes log
app.get('/api/changes', async (req, res) => {
  try {
    const content = await fs.readFile(CHANGES_LOG_PATH, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line);
    const changes = lines.map(line => JSON.parse(line));

    // Return last 100 changes
    res.json(changes.slice(-100).reverse());
  } catch (error) {
    console.error('Error reading changes log:', error);
    res.json([]);
  }
});

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');

  ws.on('error', console.error);

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Broadcast to all connected clients
function broadcast(data: any) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// Watch vault directory for changes
const watcher = chokidar.watch(VAULT_PATH, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true
});

watcher
  .on('change', async (filePath) => {
    const relativePath = path.relative(VAULT_PATH, filePath);
    console.log(`File changed: ${relativePath}`);

    // Broadcast file change event
    broadcast({
      type: 'file-changed',
      path: relativePath,
      timestamp: new Date().toISOString()
    });
  })
  .on('add', async (filePath) => {
    const relativePath = path.relative(VAULT_PATH, filePath);
    console.log(`File added: ${relativePath}`);

    broadcast({
      type: 'file-added',
      path: relativePath,
      timestamp: new Date().toISOString()
    });
  })
  .on('unlink', async (filePath) => {
    const relativePath = path.relative(VAULT_PATH, filePath);
    console.log(`File deleted: ${relativePath}`);

    broadcast({
      type: 'file-deleted',
      path: relativePath,
      timestamp: new Date().toISOString()
    });
  });

server.listen(PORT, () => {
  console.log(`Quip API server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
  console.log(`Serving files from ${VAULT_PATH}`);
  console.log(`Logging changes to ${CHANGES_LOG_PATH}`);
});
