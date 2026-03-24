export interface VaultFile {
  path: string
  name: string
  type: 'file' | 'directory'
  children?: VaultFile[]
  modified?: string
  size?: number
}

export interface FileContent {
  content: string
  frontmatter: Record<string, unknown>
}

export interface User {
  id: string
  email: string
  name: string | null
  role: string
}
