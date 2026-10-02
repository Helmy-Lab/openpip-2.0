import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSettings } from '../api/settings'
import { injectCSSVars } from '../lib/theme'
import { ThemeContext } from './useTheme'
import { useDarkMode } from '../store/darkModeStore'

interface ThemeProviderProps {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { data: settings } = useSettings()
  const { dark } = useDarkMode()
  // The navbar style can differ per page, so the vars are re-injected on
  // navigation as well as on a settings or theme change.
  const { pathname } = useLocation()

  useEffect(() => {
    if (settings) injectCSSVars(settings, pathname)
  }, [settings, dark, pathname])

  return (
    <ThemeContext.Provider value={settings ?? null}>
      {children}
    </ThemeContext.Provider>
  )
}
