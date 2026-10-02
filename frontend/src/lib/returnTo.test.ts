import { describe, it, expect } from 'vitest'
import { returnPath } from './returnTo'

describe('returnPath', () => {
  it('returns to the page that sent the visitor to sign in', () => {
    expect(returnPath({ from: { pathname: '/search/TP53', search: '?x=1', hash: '' } })).toBe(
      '/search/TP53?x=1'
    )
  })

  it('goes home with no origin, or from a sign-in page', () => {
    expect(returnPath(null)).toBe('/')
    expect(returnPath({})).toBe('/')
    expect(returnPath({ from: { pathname: '/register' } })).toBe('/')
  })
})
