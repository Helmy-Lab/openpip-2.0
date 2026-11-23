import { create } from 'zustand'
import { useSettings } from '../../../api/settings'

const KEY = 'openpip_canvas_background'

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

interface CanvasBackgroundStore {
  /** This viewer's own choice; null follows the deployment default. */
  override: string | null
  setOverride: (color: string | null) => void
}

export const useCanvasBackgroundStore = create<CanvasBackgroundStore>()((set) => ({
  override: read(),
  setOverride: (color) => {
    try {
      if (color) localStorage.setItem(KEY, color)
      else localStorage.removeItem(KEY)
    } catch {
      // Storage refused: the choice still holds for this page.
    }
    set({ override: color })
  },
}))

/**
 * The canvas background as a real color, or null to follow the theme. The
 * viewer's override wins over the admin default in Settings → Search.
 */
export function useCanvasBackground(): string | null {
  const { data: settings } = useSettings()
  const override = useCanvasBackgroundStore((s) => s.override)
  return override || settings?.canvasBackgroundColor || null
}

const STYLE_KEY = 'openpip_canvas_style'

export type CanvasColor =
  | 'queryNode'
  | 'interactorNode'
  | 'published'
  | 'validated'
  | 'verified'
  | 'literature'

/**
 * The viewer's own network colours, kept in this browser like the background.
 * A colour left unset follows the admin's in Settings → Search. Sizes are not
 * the viewer's: node size carries tissue expression.
 */
export type CanvasStyle = Partial<Record<CanvasColor, string>>

function readStyle(): CanvasStyle {
  try {
    return JSON.parse(localStorage.getItem(STYLE_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

interface CanvasStyleStore {
  style: CanvasStyle
  /** Merges a change in; null clears every choice, background included. */
  setStyle: (patch: CanvasStyle | null) => void
}

export const useCanvasStyleStore = create<CanvasStyleStore>()((set, get) => ({
  style: readStyle(),
  setStyle: (patch) => {
    const style = patch ? { ...get().style, ...patch } : {}
    try {
      localStorage.setItem(STYLE_KEY, JSON.stringify(style))
    } catch {
      // Storage refused: the choice still holds for this page.
    }
    if (!patch) useCanvasBackgroundStore.getState().setOverride(null)
    set({ style })
  },
}))

/** The query node colour the network is drawn with: the viewer's, else the admin's. */
export function useQueryNodeColor(): string {
  const { data: settings } = useSettings()
  const own = useCanvasStyleStore((s) => s.style.queryNode)
  return own ?? settings?.queryNodeColor ?? '#e11d48'
}
