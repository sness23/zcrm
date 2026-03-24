/**
 * Utility functions for blog system
 */

import { ulid } from 'ulidx'
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import sharp from 'sharp'
import type { BlogPost, MediumPost, ImageDownloadResult } from './blog-types.js'

const VAULT = path.join(process.cwd(), 'vault')
const BLOG_DIR = path.join(VAULT, 'blog')
const ASSETS_DIR = path.join(BLOG_DIR, 'assets', 'images')

/**
 * Generate blog post ID (ULID with blg_ prefix)
 */
export function generateBlogId(): string {
  return `blg_${ulid()}`
}

/**
 * Convert string to URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Calculate reading time in minutes
 */
export function calculateReadingTime(markdown: string): number {
  // Strip code blocks and frontmatter
  const content = markdown
    .replace(/^---[\s\S]*?---/, '')
    .replace(/```[\s\S]*?```/g, '')

  // Count words
  const words = content.trim().split(/\s+/).length

  // Average reading speed: 200 words per minute
  const minutes = Math.ceil(words / 200)

  return Math.max(1, minutes)
}

/**
 * Infer categories from title and content
 */
export function inferCategories(title: string, content: string): string[] {
  const categories: string[] = []
  const text = (title + ' ' + content).toLowerCase()

  // Technical indicators
  if (
    /\b(code|programming|typescript|javascript|api|database|github)\b/i.test(text) ||
    /```/.test(content)  // Has code blocks
  ) {
    categories.push('Technical')
  }

  // Science indicators
  if (
    /\b(molecule|protein|structural biology|drug discovery|biotech|pdb|crystal)\b/i.test(text)
  ) {
    categories.push('Science')
  }

  // Startup/Business indicators
  if (
    /\b(startup|founder|sales|business|fundraising|revenue|customer)\b/i.test(text)
  ) {
    categories.push('Startup')
  }

  // Personal/Story indicators
  if (
    /\b(my|journey|story|experience|learned|personal)\b/i.test(title) ||
    /\b(i\s|me\s|my\s)/i.test(content.slice(0, 500))  // First-person in intro
  ) {
    categories.push('Personal')
  }

  // AI/ML indicators
  if (
    /\b(ai|artificial intelligence|machine learning|chatgpt|claude|gpt|llm|neural|model)\b/i.test(text)
  ) {
    categories.push('AI')
  }

  return categories.length > 0 ? categories : ['General']
}

/**
 * Check if content has molecular viewer blocks
 */
export function hasMolecularContent(content: string): boolean {
  return /```mol3d/i.test(content) ||
         /\b(PDB|protein|structure|molecule viewer|molstar)\b/i.test(content)
}

/**
 * Download and optimize image
 */
export async function downloadAndOptimizeImage(
  url: string,
  postSlug: string,
  pubDate: string
): Promise<ImageDownloadResult> {
  try {
    // Download image
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BlogImporter/1.0)'
      }
    })

    const buffer = Buffer.from(response.data)

    // Get date for directory structure
    const date = new Date(pubDate)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')

    // Generate filename
    const timestamp = Date.now()
    const filename = `${postSlug}-${timestamp}.webp`
    const relativePath = `./assets/images/${year}/${month}/${filename}`
    const fullPath = path.join(ASSETS_DIR, String(year), month, filename)

    // Create directories
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })

    // Optimize image
    let optimized = await sharp(buffer)
      .resize(1200, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({ quality: 85 })
      .toBuffer()

    // If still too large, reduce quality
    if (optimized.length > 500 * 1024) {
      optimized = await sharp(buffer)
        .resize(800, null, { withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer()
    }

    // Save
    fs.writeFileSync(fullPath, optimized)

    return {
      originalUrl: url,
      localPath: fullPath,
      relativePath,
      size: optimized.length,
      optimized: true
    }
  } catch (error: any) {
    console.error(`Failed to download image: ${url}`, error.message)
    throw error
  }
}

/**
 * Extract and download all images from markdown
 */
export async function extractAndDownloadImages(
  markdown: string,
  postSlug: string,
  pubDate: string
): Promise<{ content: string; images: ImageDownloadResult[] }> {
  const imageRegex = /!\[(.*?)\]\((https:\/\/[^\)]+)\)/g
  let match
  let updatedMarkdown = markdown
  const images: ImageDownloadResult[] = []

  const matches = Array.from(markdown.matchAll(imageRegex))

  for (const match of matches) {
    const [fullMatch, alt, url] = match

    // Skip if not a CDN image (already local or external link we want to keep)
    if (!url.includes('cdn-images') && !url.includes('medium.com')) {
      continue
    }

    try {
      console.log(`  Downloading: ${url}`)
      const result = await downloadAndOptimizeImage(url, postSlug, pubDate)
      images.push(result)

      // Replace URL in markdown
      updatedMarkdown = updatedMarkdown.replace(
        fullMatch,
        `![${alt}](${result.relativePath})`
      )

      console.log(`  ✓ Saved: ${result.relativePath} (${Math.round(result.size / 1024)}KB)`)
    } catch (error) {
      console.warn(`  ⚠ Failed to download image, keeping original URL: ${url}`)
      // Keep original URL as fallback
    }
  }

  return { content: updatedMarkdown, images }
}

/**
 * Transform Medium post to BlogPost format
 */
export function transformMediumPost(medium: MediumPost): Omit<BlogPost, 'content'> {
  const id = generateBlogId()
  const slug = slugify(medium.title)
  const pubDate = new Date(medium.date).toISOString()
  const updatedDate = new Date().toISOString()

  // Parse tags if present
  let tags: string[] = []
  if (medium.tags) {
    tags = medium.tags.split(',').map(t => t.trim()).filter(Boolean)
  }

  // Infer categories
  const categories = inferCategories(medium.title, medium.content)

  return {
    id,
    title: medium.title,
    slug,
    pubDate,
    updatedDate,
    author: medium.author || 'sness23',
    status: 'published',
    tags,
    categories,
    mediumUrl: medium.original_url,
    sourceUrl: medium.original_url,
    sourceFeed: 'Medium (@sness23)',
    enableMolecularViewer: hasMolecularContent(medium.content),
    readingTime: calculateReadingTime(medium.content)
  }
}

/**
 * Ensure unique slug (append number if needed)
 */
export function ensureUniqueSlug(slug: string): string {
  const existing = path.join(BLOG_DIR, `${slug}.md`)
  if (!fs.existsSync(existing)) {
    return slug
  }

  let counter = 2
  while (fs.existsSync(path.join(BLOG_DIR, `${slug}-${counter}.md`))) {
    counter++
  }
  return `${slug}-${counter}`
}

/**
 * Ensure directories exist
 */
export function ensureBlogDirectories(): void {
  fs.mkdirSync(BLOG_DIR, { recursive: true })
  fs.mkdirSync(ASSETS_DIR, { recursive: true })
}

/**
 * Format file size for display
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
