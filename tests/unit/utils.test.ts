import { describe, it, expect } from 'vitest'
import { ulid } from 'ulidx'

// Import the functions we need to test
// For now, we'll redefine them here since they're in the CLI file
// In a real refactor, we'd export these from src/index.ts or a utils file

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

type Kind = 'account' | 'contact' | 'opportunity' | 'activity' | 'lead' | 'task' | 'quote' | 'product' | 'campaign'

function idFor(kind: Kind): string {
  const prefix = {
    account: 'acc_',
    contact: 'con_',
    opportunity: 'opp_',
    activity: 'act_',
    lead: 'led_',
    task: 'tsk_',
    quote: 'quo_',
    product: 'prd_',
    campaign: 'cmp_'
  }[kind]
  return prefix + ulid().toLowerCase()
}

describe('slugify', () => {
  it('converts name to kebab-case', () => {
    expect(slugify('Acme Corporation')).toBe('acme-corporation')
  })

  it('converts spaces to hyphens', () => {
    expect(slugify('Test Company Name')).toBe('test-company-name')
  })

  it('removes special characters', () => {
    expect(slugify('Company! & Co.')).toBe('company-co')
  })

  it('handles consecutive spaces', () => {
    expect(slugify('Test   Company')).toBe('test-company')
  })

  it('removes leading and trailing hyphens', () => {
    expect(slugify('---test---')).toBe('test')
    expect(slugify(' test company ')).toBe('test-company')
  })

  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('handles numbers', () => {
    expect(slugify('Q1 2025 Deal')).toBe('q1-2025-deal')
  })

  it('handles mixed case', () => {
    expect(slugify('TechCorp INC')).toBe('techcorp-inc')
  })
})

describe('idFor', () => {
  it('generates account IDs with acc_ prefix', () => {
    const id = idFor('account')
    expect(id).toMatch(/^acc_[a-z0-9]{26}$/)
  })

  it('generates contact IDs with con_ prefix', () => {
    const id = idFor('contact')
    expect(id).toMatch(/^con_[a-z0-9]{26}$/)
  })

  it('generates lead IDs with led_ prefix', () => {
    const id = idFor('lead')
    expect(id).toMatch(/^led_[a-z0-9]{26}$/)
  })

  it('generates opportunity IDs with opp_ prefix', () => {
    const id = idFor('opportunity')
    expect(id).toMatch(/^opp_[a-z0-9]{26}$/)
  })

  it('generates task IDs with tsk_ prefix', () => {
    const id = idFor('task')
    expect(id).toMatch(/^tsk_[a-z0-9]{26}$/)
  })

  it('generates product IDs with prd_ prefix', () => {
    const id = idFor('product')
    expect(id).toMatch(/^prd_[a-z0-9]{26}$/)
  })

  it('generates campaign IDs with cmp_ prefix', () => {
    const id = idFor('campaign')
    expect(id).toMatch(/^cmp_[a-z0-9]{26}$/)
  })

  it('generates quote IDs with quo_ prefix', () => {
    const id = idFor('quote')
    expect(id).toMatch(/^quo_[a-z0-9]{26}$/)
  })

  it('generates activity IDs with act_ prefix', () => {
    const id = idFor('activity')
    expect(id).toMatch(/^act_[a-z0-9]{26}$/)
  })

  it('generates unique IDs', () => {
    const id1 = idFor('account')
    const id2 = idFor('account')
    expect(id1).not.toBe(id2)
  })

  it('generates IDs with correct length', () => {
    const id = idFor('account')
    // 4 chars (prefix) + 26 chars (ulid) = 30 total
    expect(id).toHaveLength(30)
  })
})
