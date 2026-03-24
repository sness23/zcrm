import crypto from 'crypto'
import { ulid } from 'ulidx'
import type Database from 'better-sqlite3'

export interface User {
  id: string
  email: string
  name: string | null
  role: string
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: string
  token: string
  expires_at: string
  created_at: string
}

// Simple password hashing using PBKDF2
const SALT_LENGTH = 16
const KEY_LENGTH = 64
const ITERATIONS = 100000

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':')
  const verifyHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512').toString('hex')
  return hash === verifyHash
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export class AuthService {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  /**
   * Register a new user
   */
  register(email: string, password: string, name?: string): { user: User; token: string } {
    const existing = this.db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) {
      throw new Error('User with this email already exists')
    }

    const now = new Date().toISOString()
    const userId = `usr_${ulid()}`
    const passwordHash = hashPassword(password)

    this.db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'user', ?, ?)
    `).run(userId, email, passwordHash, name || null, now, now)

    const user = this.getUserById(userId)!
    const session = this.createSession(userId)

    return { user, token: session.token }
  }

  /**
   * Login with email and password
   */
  login(email: string, password: string): { user: User; token: string } {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
    if (!row) {
      throw new Error('Invalid email or password')
    }

    if (!verifyPassword(password, row.password_hash)) {
      throw new Error('Invalid email or password')
    }

    const user: User = {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }

    const session = this.createSession(user.id)
    return { user, token: session.token }
  }

  /**
   * Logout (invalidate session)
   */
  logout(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  }

  /**
   * Validate token and get user
   */
  validateToken(token: string): User | null {
    const session = this.db.prepare(`
      SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')
    `).get(token) as Session | undefined

    if (!session) {
      return null
    }

    return this.getUserById(session.user_id)
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): User | null {
    const row = this.db.prepare('SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?').get(id) as any
    if (!row) return null
    return row as User
  }

  /**
   * Create a new session for user
   */
  private createSession(userId: string): Session {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const session: Session = {
      id: `ses_${ulid()}`,
      user_id: userId,
      token: generateToken(),
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    }

    this.db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(session.id, session.user_id, session.token, session.expires_at, session.created_at)

    return session
  }

  /**
   * Clean up expired sessions
   */
  cleanExpiredSessions(): number {
    const result = this.db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run()
    return result.changes
  }

  /**
   * Seed demo users (for development)
   */
  seedDemoUsers(): void {
    const demoUsers = [
      { email: 'demo@doi.bio', password: 'demo123', name: 'Demo User' },
      { email: 'admin@doi.bio', password: 'admin123', name: 'Admin User' },
      { email: 'user1@example.com', password: 'test123', name: 'Test User 1' },
      { email: 'user2@example.com', password: 'test123', name: 'Test User 2' },
      { email: 'user3@example.com', password: 'test123', name: 'Test User 3' },
    ]

    for (const user of demoUsers) {
      const existing = this.db.prepare('SELECT id FROM users WHERE email = ?').get(user.email)
      if (!existing) {
        const now = new Date().toISOString()
        const userId = `usr_${ulid()}`
        const passwordHash = hashPassword(user.password)
        const role = user.email.includes('admin') ? 'admin' : 'user'

        this.db.prepare(`
          INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, user.email, passwordHash, user.name, role, now, now)

        console.log(`✓ Created demo user: ${user.email}`)
      }
    }
  }
}
