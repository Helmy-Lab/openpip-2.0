import { useState } from 'react'
import { supportedPatterns, unsupportedPatterns } from '../../lib/naturalQuery'

/**
 * What the home page search box understands, for the admin writing examples.
 *
 * Every line is generated from the parser's own vocabulary rather than written
 * out here, so the panel cannot promise a capability that was renamed or
 * removed — including the tissue list, which is the one an admin most needs and
 * the one most likely to change under a different dataset.
 *
 * It also states what the box cannot do. An example that demonstrates an
 * unsupported filter would teach visitors a phrasing that quietly does nothing,
 * which is worse than no example at all.
 */
export function PhraseHelp() {
  const [open, setOpen] = useState(false)
  const patterns = supportedPatterns()
  const unsupported = unsupportedPatterns()

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="op-btn"
        style={{ fontSize: 12, padding: '5px 12px', marginBottom: 16 }}
      >
        What can be written here?
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,.45)',
            padding: 24,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="What can be written in the search box"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: 'var(--shadow-lg)',
              padding: 28,
              maxWidth: 620,
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 6,
              }}
            >
              <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: 'var(--text)' }}>
                What visitors can type
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 20,
                  lineHeight: 1,
                  color: 'var(--text-muted)',
                }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' }}>
              The search box reads a phrase and turns it into a gene search plus
              filters. Write examples that show these off.
            </p>

            {Object.entries(patterns).map(([key, pattern]) => (
              <section key={key} style={{ marginBottom: 22 }}>
                <h3
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text)',
                    margin: '0 0 6px',
                  }}
                >
                  {pattern.title}
                </h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  {pattern.examples.map((example) => (
                    <code
                      key={example}
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        color: 'var(--text)',
                      }}
                    >
                      {example}
                    </code>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                  {pattern.note}
                </p>
                {'values' in pattern && (
                  <details style={{ marginTop: 8 }}>
                    <summary
                      style={{ fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }}
                    >
                      Show all {pattern.values.length}
                    </summary>
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        margin: '8px 0 0',
                        lineHeight: 1.7,
                      }}
                    >
                      {pattern.values.join(' · ')}
                    </p>
                  </details>
                )}
              </section>
            ))}

            <section
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 16,
              }}
            >
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
                Not available
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                The box recognises {unsupported.join(' and ')} but cannot filter
                by them, and says so to the visitor. Do not write an example that
                relies on one, it would teach a phrasing that quietly does
                nothing.
              </p>
            </section>
          </div>
        </div>
      )}
    </>
  )
}
