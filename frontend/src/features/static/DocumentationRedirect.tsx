import { useEffect } from 'react'

/**
 * /documentation used to be a short in-app guide. The full documentation site
 * is now served beside the app at <base>/docs/, so old links land there.
 */
export function DocumentationRedirect() {
  const target = `${import.meta.env.BASE_URL}docs/`
  useEffect(() => {
    window.location.replace(target)
  }, [target])
  return (
    <p style={{ padding: 24, color: 'var(--text-muted)' }}>
      The documentation has moved to <a href={target}>{target}</a>.
    </p>
  )
}
