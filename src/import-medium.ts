#!/usr/bin/env node
/**
 * Import Medium blog posts to vault/blog/
 *
 * Usage:
 *   npm run import:medium
 *   tsx src/import-medium.ts
 *   tsx src/import-medium.ts --dry-run
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { MediumPost, BlogPost, ImportResult, ImportSummary } from './lib/blog-types.js'
import {
  transformMediumPost,
  extractAndDownloadImages,
  ensureUniqueSlug,
  ensureBlogDirectories,
  formatBytes
} from './lib/blog-utils.js'

const MEDIUM_DIR = path.join(process.cwd(), 'docs/medium')
const VAULT_DIR = path.join(process.cwd(), 'vault')
const BLOG_DIR = path.join(VAULT_DIR, 'blog')

const DRY_RUN = process.argv.includes('--dry-run')

/**
 * Parse Medium markdown file
 */
function parseMediumPost(filepath: string): MediumPost {
  const raw = fs.readFileSync(filepath, 'utf-8')
  const { data, content } = matter(raw)

  return {
    title: data.title,
    date: data.date,
    original_url: data.original_url,
    categories: data.categories || [],
    source: data.source || 'medium',
    author: data.author || 'sness23',
    tags: data.tags,
    content
  }
}

/**
 * Import a single Medium post
 */
async function importMediumPost(filepath: string, filename: string): Promise<ImportResult> {
  const errors: string[] = []

  try {
    console.log(`\n📄 Importing: ${filename}`)

    // Parse Medium post
    const medium = parseMediumPost(filepath)
    console.log(`  Title: ${medium.title}`)

    // Transform to BlogPost format
    const post = transformMediumPost(medium)
    console.log(`  ID: ${post.id}`)
    console.log(`  Slug: ${post.slug}`)
    console.log(`  Categories: ${post.categories?.join(', ') || 'none'}`)
    console.log(`  Tags: ${post.tags?.join(', ') || 'none'}`)
    console.log(`  Reading time: ${post.readingTime} min`)
    console.log(`  Molecular viewer: ${post.enableMolecularViewer ? 'yes' : 'no'}`)

    // Ensure unique slug
    const uniqueSlug = ensureUniqueSlug(post.slug)
    if (uniqueSlug !== post.slug) {
      console.log(`  ⚠ Slug conflict, using: ${uniqueSlug}`)
      post.slug = uniqueSlug
    }

    // Extract and download images
    console.log(`  Extracting images...`)
    const { content: updatedContent, images } = await extractAndDownloadImages(
      medium.content,
      post.slug,
      post.pubDate
    )

    if (images.length > 0) {
      console.log(`  ✓ Downloaded ${images.length} image(s)`)
      const totalSize = images.reduce((sum, img) => sum + img.size, 0)
      console.log(`  ✓ Total image size: ${formatBytes(totalSize)}`)
    } else {
      console.log(`  ℹ No images to download`)
    }

    // Create final post
    const finalPost: BlogPost = {
      ...post,
      content: updatedContent
    }

    // Write to vault (unless dry run)
    if (!DRY_RUN) {
      const destPath = path.join(BLOG_DIR, `${post.slug}.md`)
      // Clean up frontmatter - remove undefined values and content field
      const frontmatter: any = {}
      Object.keys(finalPost).forEach(key => {
        if (key !== 'content' && finalPost[key as keyof BlogPost] !== undefined) {
          frontmatter[key] = finalPost[key as keyof BlogPost]
        }
      })
      const markdown = matter.stringify(finalPost.content || '', frontmatter)
      fs.writeFileSync(destPath, markdown, 'utf-8')
      console.log(`  ✓ Saved: ${destPath}`)
    } else {
      console.log(`  [DRY RUN] Would save to: ${post.slug}.md`)
    }

    return {
      success: true,
      post: finalPost,
      images,
      errors
    }
  } catch (error: any) {
    const errorMsg = `Failed to import ${filename}: ${error.message}`
    console.error(`  ✗ ${errorMsg}`)
    errors.push(errorMsg)

    return {
      success: false,
      post: {} as BlogPost,
      images: [],
      errors
    }
  }
}

/**
 * Import all Medium posts
 */
async function importAll(): Promise<ImportSummary> {
  console.log('🚀 Medium Post Importer')
  console.log('========================\n')

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No files will be written\n')
  }

  // Ensure directories exist
  if (!DRY_RUN) {
    ensureBlogDirectories()
    console.log(`✓ Directories ready\n`)
  }

  // Find all Medium posts
  const files = fs.readdirSync(MEDIUM_DIR)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()

  console.log(`Found ${files.length} Medium posts to import:\n`)
  files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))

  // Import each post
  const results: ImportResult[] = []
  for (const file of files) {
    const filepath = path.join(MEDIUM_DIR, file)
    const result = await importMediumPost(filepath, file)
    results.push(result)
  }

  // Generate summary
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const totalImages = results.reduce((sum, r) => sum + r.images.length, 0)
  const totalImageSize = results.reduce(
    (sum, r) => sum + r.images.reduce((s, img) => s + img.size, 0),
    0
  )

  const summary: ImportSummary = {
    total: files.length,
    successful,
    failed,
    results,
    totalImages,
    totalImageSize
  }

  return summary
}

/**
 * Print summary
 */
function printSummary(summary: ImportSummary): void {
  console.log('\n\n📊 Import Summary')
  console.log('==================')
  console.log(`Total posts: ${summary.total}`)
  console.log(`✓ Successful: ${summary.successful}`)
  console.log(`✗ Failed: ${summary.failed}`)
  console.log(`📷 Total images: ${summary.totalImages}`)
  console.log(`💾 Total image size: ${formatBytes(summary.totalImageSize)}`)

  if (summary.failed > 0) {
    console.log('\n⚠️  Failed imports:')
    summary.results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  ✗ ${r.post.title || 'Unknown'}`)
        r.errors.forEach(e => console.log(`    - ${e}`))
      })
  }

  if (summary.successful > 0) {
    console.log('\n✅ Successfully imported:')
    summary.results
      .filter(r => r.success)
      .forEach(r => {
        console.log(`  ✓ ${r.post.title}`)
        console.log(`    - Slug: ${r.post.slug}`)
        console.log(`    - Images: ${r.images.length}`)
        console.log(`    - Categories: ${r.post.categories?.join(', ') || 'none'}`)
      })
  }

  if (!DRY_RUN && summary.successful > 0) {
    console.log('\n🎉 Import complete!')
    console.log(`\nNext steps:`)
    console.log(`  1. Review posts in vault/blog/`)
    console.log(`  2. Check images in vault/blog/assets/images/`)
    console.log(`  3. Validate: npm run validate:blog`)
    console.log(`  4. Commit: git add vault/blog/ && git commit -m "blog: import Medium posts"`)
  } else if (DRY_RUN) {
    console.log('\n✅ Dry run complete! Run without --dry-run to import.')
  }
}

/**
 * Main
 */
async function main() {
  try {
    // Check if Medium directory exists
    if (!fs.existsSync(MEDIUM_DIR)) {
      console.error(`Error: Medium directory not found: ${MEDIUM_DIR}`)
      process.exit(1)
    }

    // Check if vault exists
    if (!fs.existsSync(VAULT_DIR)) {
      console.error(`Error: Vault directory not found: ${VAULT_DIR}`)
      console.error(`Run: node dist/index.js init`)
      process.exit(1)
    }

    // Run import
    const summary = await importAll()

    // Print summary
    printSummary(summary)

    // Exit with appropriate code
    process.exit(summary.failed > 0 ? 1 : 0)
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { importAll, importMediumPost, parseMediumPost }
