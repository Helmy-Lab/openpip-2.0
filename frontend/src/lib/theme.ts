import type { AdminSettings } from '../types/api'
import { navPageIdFor, parseNavOverrides } from './navPages'

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return null
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if ([r, g, b].some(isNaN)) return null
  return [r, g, b]
}

function mixWith(hex: string, target: number, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const [r, g, b] = rgb
  const mix = (c: number) => Math.round(c * amount + target * (1 - amount))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

type Rgb = [number, number, number]

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)]
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function shiftChannels(rgb: Rgb, factor: number, towardWhite: boolean): Rgb {
  const shift = (c: number) =>
    towardWhite ? Math.round(c + (255 - c) * factor) : Math.round(c * (1 - factor))
  return [shift(rgb[0]), shift(rgb[1]), shift(rgb[2])]
}

/**
 * Push the brand colour away from `background` until it is legible on it.
 *
 * Admins pick an arbitrary brand hex, and a fixed lighten/darken factor cannot
 * serve all of them: a near-black brand (openPIP ships #0f172a) lightened by a
 * flat 50% lands on a mid grey that fails against a tinted dark chip. Stepping
 * until the ratio clears the target keeps the shade legible whatever the brand,
 * and stops as soon as it does so the colour stays as close to brand as it can.
 */
function shadeForContrast(
  hex: string,
  background: Rgb,
  targetRatio: number,
  towardWhite: boolean
): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  let result = rgb as Rgb
  for (let factor = towardWhite ? 0.5 : 0.25; factor <= 0.95; factor += 0.05) {
    result = shiftChannels(rgb as Rgb, factor, towardWhite)
    if (contrastRatio(result, background) >= targetRatio) break
  }
  return `rgb(${result[0]}, ${result[1]}, ${result[2]})`
}

function parseRgbTriplet(value: string): Rgb {
  const parts = value.match(/\d+/g)
  return parts ? ([+parts[0], +parts[1], +parts[2]] as Rgb) : [0, 0, 0]
}

/**
 * The navbar style in force on a route: the page's own choice if an admin set
 * one, otherwise the site-wide default.
 */
export function navStyleFor(settings: AdminSettings, pathname?: string): string {
  const fallback = settings.navStyle || 'solid'
  if (!pathname) return fallback
  const pageId = navPageIdFor(pathname)
  if (!pageId) return fallback
  return parseNavOverrides(settings.navStyleOverrides)[pageId] || fallback
}

export function injectCSSVars(settings: AdminSettings, pathname?: string): void {
  const root = document.documentElement
  const isDark = root.dataset.theme === 'dark'

  const primary  = settings.mainColorScheme  || '#2563eb'
  const primary2 = settings.mainColorScheme2 || '#0ea5e9'
  const angle    = settings.gradientAngle    ?? 135
  const style    = navStyleFor(settings, pathname)

  // Primary brand color + derived shades.
  //
  // --primary-soft is a tinted *background* (chips, badges, selected rows). In
  // dark mode it must sit above --surface (#11161f), not below it: mixing toward
  // pure black put it at rgb(2,3,6) for the shipped #0f172a brand, darker than
  // the surface it sits on, so chips were invisible. Mixing toward a lifted
  // neutral gives a tint that reads whatever the brand's own lightness.
  //
  // --primary-deep is the readable *foreground* shade, and it is derived against
  // --primary-soft because text on a chip is the tightest pairing of the two.
  const softBackground = isDark ? mixWith(primary, 48, 0.2) : mixWith(primary, 255, 0.14)

  root.style.setProperty('--primary', primary)
  root.style.setProperty('--primary-soft', softBackground)
  root.style.setProperty(
    '--primary-deep',
    shadeForContrast(primary, parseRgbTriplet(softBackground), 4.5, isDark)
  )

  // Header background - solid, gradient, or light (white)
  let navBg: string
  if (style === 'gradient') {
    navBg = `linear-gradient(${angle}deg, ${primary}, ${primary2})`
  } else if (style === 'light') {
    navBg = 'var(--surface)'
  } else {
    navBg = primary
  }
  root.style.setProperty('--nav-bg', navBg)

  // Header text color: auto-dark when light nav, otherwise admin-set
  const headerText = style === 'light'
    ? 'var(--text)'
    : (settings.headerColorScheme || '#ffffff')
  root.style.setProperty('--color-header', headerText)

  // Legacy admin slots
  root.style.setProperty('--color-main',   primary)
  root.style.setProperty('--color-logo',   settings.logoColorScheme   || '#ffffff')
  root.style.setProperty('--color-button', settings.buttonColorScheme || primary)

  // Network viz - node colors (also drive --query / --interactor via CSS)
  root.style.setProperty('--color-query-node',      settings.queryNodeColor      || '#e11d48')
  root.style.setProperty('--color-interactor-node', settings.interactorNodeColor || '#2563eb')

  // Network viz - edge colors (also drive --literature / --hi-union / --huri-lit via CSS)
  root.style.setProperty('--color-edge-published',  settings.publishedEdgeColor  || '#38761d')
  root.style.setProperty('--color-edge-validated',  settings.validatedEdgeColor  || '#1155cc')
  root.style.setProperty('--color-edge-verified',   settings.verifiedEdgeColor   || '#cc0000')
  root.style.setProperty('--color-edge-literature', settings.literatureEdgeColor || '#0ea5e9')
  root.style.setProperty('--color-edge-mixed', '#ff55dd')
}
