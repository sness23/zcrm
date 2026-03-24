#!/usr/bin/env node
/**
 * Validate blog posts
 *
 * Usage:
 *   npm run validate:blog
 *   tsx src/validate-blog.ts
 *   tsx src/validate-blog.ts --verbose
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const VAULT = path.join(process.cwd(), 'vault')
const BLOG_DIR = path.join(VAULT, 'blog')
const SCHEMA_PATH = path.join(VAULT, '_schemas', 'BlogPost.schema.json')

const VERBOSE = process.argv.includes('--verbose')

interface ValidationResult {
  file: string
  valid: boolean
  errors: string[]
}

/**
 * Load JSON schema
 */
function loadSchema() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`Schema not found: ${SCHEMA_PATH}`)
  }

  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'))
  const ajv = new Ajv({ allErrors: true, strict: false })
  addFormats(ajv)
  return ajv.compile(schema)
}

/**
 * Validate a single post
 */
function validatePost(filepath: string, validate: any): ValidationResult {
  const filename = path.basename(filepath)
  const errors: string[] = []

  try {
    // Parse frontmatter
    const content = fs.readFileSync(filepath, 'utf-8')
    const { data, content: markdown } = matter(content)

    // Validate against schema
    const valid = validate(data)
    if (!valid && validate.errors) {
      validate.errors.forEach((err: any) => {
        const field = err.instancePath.slice(1) || err.params.missingProperty
        errors.push(`${field}: ${err.message}`)
      })
    }

    // Check for broken image links
    const imageRegex = /!\[(.*?)\]\((\.\/assets\/[^\)]+)\)/g
    let match
    while ((match = imageRegex.exec(markdown)) !== null) {
      const [, alt, imagePath] = match
      const fullImagePath = path.join(BLOG_DIR, imagePath)
      if (!fs.existsSync(fullImagePath)) {
        errors.push(`Missing image: ${imagePath}`)
      }
    }

    // Check for external Medium images (should be local)
    const externalImageRegex = /!\[(.*?)\]\((https:\/\/cdn-images[^\)]+)\)/g
    while ((match = externalImageRegex.exec(markdown)) !== null) {
      const [, , url] = match
      errors.push(`External image not downloaded: ${url}`)
    }

    return {
      file: filename,
      valid: errors.length === 0,
      errors
    }
  } catch (error: any) {
    return {
      file: filename,
      valid: false,
      errors: [`Failed to parse: ${error.message}`]
    }
  }
}

/**
 * Validate all posts
 */
function validateAll() {
  console.log('🔍 Blog Post Validator')
  console.log('======================\n')

  // Check if blog directory exists
  if (!fs.existsSync(BLOG_DIR)) {
    console.error(`Error: Blog directory not found: ${BLOG_DIR}`)
    console.error(`Run: npm run import:medium`)
    process.exit(1)
  }

  // Load schema
  console.log('Loading schema...')
  const validate = loadSchema()
  console.log('✓ Schema loaded\n')

  // Find all posts
  const files = fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()

  if (files.length === 0) {
    console.log('No blog posts found.')
    process.exit(0)
  }

  console.log(`Validating ${files.length} post(s)...\n`)

  // Validate each post
  const results: ValidationResult[] = []
  for (const file of files) {
    const filepath = path.join(BLOG_DIR, file)
    const result = validatePost(filepath, validate)
    results.push(result)

    if (result.valid) {
      console.log(`✓ ${file}`)
    } else {
      console.log(`✗ ${file}`)
      if (VERBOSE) {
        result.errors.forEach(err => console.log(`    - ${err}`))
      }
    }
  }

  // Print summary
  const valid = results.filter(r => r.valid).length
  const invalid = results.filter(r => !r.valid).length
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

  console.log('\n📊 Validation Summary')
  console.log('=====================')
  console.log(`Total posts: ${files.length}`)
  console.log(`✓ Valid: ${valid}`)
  console.log(`✗ Invalid: ${invalid}`)
  console.log(`Total errors: ${totalErrors}`)

  if (invalid > 0) {
    console.log('\n⚠️  Invalid posts:')
    results
      .filter(r => !r.valid)
      .forEach(r => {
        console.log(`  ✗ ${r.file}`)
        r.errors.forEach(e => console.log(`    - ${e}`))
      })

    console.log('\nRun with --verbose for detailed error messages.')
    process.exit(1)
  } else {
    console.log('\n✅ All posts valid!')
    process.exit(0)
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateAll()
}

export { validatePost, validateAll }
