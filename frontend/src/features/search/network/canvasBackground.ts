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
