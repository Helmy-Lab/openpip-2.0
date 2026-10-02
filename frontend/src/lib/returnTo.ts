import type { Location } from 'react-router-dom'

const NOT_A_DESTINATION = ['/login', '/register', '/forgot-password', '/reset-password']

/**
 * Where to go after signing in: the page the visitor was on when they were
 * sent to sign in, carried as location state { from }. Never back to the
 * sign-in pages themselves, and the home page when there is no such page.
 */
export function returnPath(state: unknown): string {
  const from = (state as { from?: Partial<Location> } | null)?.from
  if (!from?.pathname || NOT_A_DESTINATION.includes(from.pathname)) return '/'
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}
