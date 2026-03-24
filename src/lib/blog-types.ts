/**
 * Type definitions for blog system
 */

export interface BlogPost {
  id: string                    // ULID with blg_ prefix
  title: string                 // Post title
  slug: string                  // URL-friendly slug
  pubDate: string               // Publication date (ISO 8601)
  updatedDate?: string          // Last modified (ISO 8601)
  author: string                // Author name
  authorEmail?: string          // Author email
  status: 'published'           // Always published
  featuredImage?: string        // Path to hero image (relative to blog/)
  excerpt?: string              // Short description
  tags?: string[]               // Tags
  categories?: string[]         // Categories
  mediumUrl?: string            // Original Medium URL
  sourceUrl?: string            // Original source URL
  sourceFeed?: string           // Feed name
  enableMolecularViewer?: boolean  // Enable mol3d blocks
  toc?: boolean                 // Show table of contents
  readingTime?: number          // Estimated minutes
  relatedPosts?: string[]       // IDs of related posts
  seo?: {
    description?: string
    keywords?: string[]
    ogImage?: string
  }
  content?: string              // Markdown body (not in frontmatter)
}

export interface MediumPost {
  title: string
  date: string
  original_url: string
  categories?: string[]
  source: string
  author: string
  tags?: string
  content: string
}

export interface ImageDownloadResult {
  originalUrl: string
  localPath: string
  relativePath: string
  size: number
  optimized: boolean
}

export interface ImportResult {
  success: boolean
  post: BlogPost
  images: ImageDownloadResult[]
  errors: string[]
}

export interface ImportSummary {
  total: number
  successful: number
  failed: number
  results: ImportResult[]
  totalImages: number
  totalImageSize: number
}
