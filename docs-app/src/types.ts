export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  isDocuments?: boolean;
}

export interface FileContent {
  path: string;
  frontmatter: Record<string, any>;
  content: string;
  raw: string;
}

export interface ChangeLogEntry {
  timestamp: string;
  action: string;
  filePath: string;
  content?: string;
}
