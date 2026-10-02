import { describe, it, expect } from 'vitest'
import { navPageIdFor, parseNavOverrides, formatNavOverrides } from '../navPages'
import { navStyleFor } from '../theme'
import type { AdminSettings } from '../../types/api'

const settings = (navStyle: string, navStyleOverrides?: string) =>
  ({ navStyle, navStyleOverrides }) as AdminSettings

describe('navPageIdFor', () => {
  it('maps a route to the page that owns it', () => {
    expect(navPageIdFor('/')).toBe('home')
    expect(navPageIdFor('/search')).toBe('search')
    expect(navPageIdFor('/search/TP53')).toBe('search')
    expect(navPageIdFor('/register')).toBe('accounts')
  })

  it('returns null for a route no page claims', () => {
    expect(navPageIdFor('/nowhere')).toBeNull()
  })
})

describe('parseNavOverrides', () => {
  it('reads pairs and drops unknown pages', () => {
    expect(parseNavOverrides('home:gradient,nope:solid')).toEqual({ home: 'gradient' })
    expect(parseNavOverrides('')).toEqual({})
    expect(parseNavOverrides(null)).toEqual({})
  })

  it('round-trips through formatNavOverrides', () => {
    const value = 'home:gradient,search:solid'
    expect(formatNavOverrides(parseNavOverrides(value))).toBe(value)
  })
})

describe('navStyleFor', () => {
  it('uses the site default where a page has no override', () => {
    expect(navStyleFor(settings('solid', 'home:gradient'), '/search')).toBe('solid')
    expect(navStyleFor(settings('solid'), '/')).toBe('solid')
  })

  it('prefers the page override', () => {
    expect(navStyleFor(settings('solid', 'home:gradient'), '/')).toBe('gradient')
    expect(navStyleFor(settings('gradient', 'search:light'), '/search/TP53')).toBe('light')
  })

  it('falls back to the default with no route given', () => {
    expect(navStyleFor(settings('gradient', 'home:solid'))).toBe('gradient')
  })
})
