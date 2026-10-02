import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../../api/settings'
import { useText, parseLines } from '../../text'
import { DatasetCitations } from './DatasetCitations'

const ExternalLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
    {children}
  </a>
)

const h2Style: CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: '-.01em',
  color: 'var(--text)',
  margin: '48px 0 16px',
  paddingTop: 24,
  borderTop: '1px solid var(--border)',
}

const h3Style: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text)',
  margin: '24px 0 8px',
}

const pStyle: CSSProperties = {
  fontSize: 14,
  color: 'var(--text-muted)',
  lineHeight: 1.75,
  margin: '0 0 12px',
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  margin: '16px 0 24px',
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--text-muted)',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '8px 12px',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  verticalAlign: 'top',
  lineHeight: 1.5,
}

const rowHeadStyle: CSSProperties = {
  ...tdStyle,
  fontWeight: 500,
  color: 'var(--text-muted)',
  background: 'var(--surface-2)',
}

const VECTOR_ROWS: string[][] = [
  ['Fusion', 'Gal4-DB (aa 1-147)', 'Gal4-AD (aa 768-881)', 'Gal4-AD (aa 768-881)', 'Gal4-AD (aa 768-881)'],
  ['Fusion location', 'N-term', 'N-term', 'N-term', 'C-term'],
  [
    'Promoter',
    'Truncated ADH1 promoter (-701 to +1)',
    'Truncated ADH1 promoter (-701 to +1)',
    'Truncated ADH1 promoter (-410 to +1)',
    'Truncated ADH1 promoter (-410 to +1)',
  ],
  ['Yeast replication ori', 'CEN', 'CEN', '2micron', '2micron'],
  ['Linker', 'SRSNQ', 'GGSNQ', 'ICMAYPYDVPDYASLGGHMAMEAPS', 'VDGTA'],
  ['Terminator', 'ADH1 Term', 'ADH1 Term', 'ADH1 Term', 'ADH1 Term'],
  ['Selection marker', 'AmpR', 'AmpR', 'AmpR', 'AmpR'],
]

const VECTOR_HEADERS = ['Name', 'pDEST-DB', 'pDEST-AD-CHY2', 'pDEST-QZ213', 'pDEST-AD-AR68']

const ASSAY_HEADERS = ['Assay version', 'DB vector', 'AD vector', 'DB yeast strain', 'AD yeast strain']

const ASSAY_ROWS: string[][] = [
  ['0', 'pDEST-DB', 'pDEST-AD-CHY2', 'MaV203', 'MaV103'],
  ['1', 'pDEST-DB', 'pDEST-AD-CHY2', 'Y8930', 'Y8800'],
  ['2', 'pDEST-DB', 'pDEST-QZ213', 'Y8930', 'Y8800'],
  ['3', 'pDEST-DB', 'pDEST-AD-AR68', 'Y8930', 'Y8800'],
]

/** A heading + prose block. Renders nothing when the admin has blanked both. */
function Block({
  heading,
  body,
  level = 2,
}: {
  heading: string
  body?: string
  level?: 2 | 3
}) {
  if (!heading.trim() && !body?.trim()) return null
  const Heading = level === 2 ? 'h2' : 'h3'
  const headingStyle = level === 2 ? h2Style : h3Style
  return (
    <>
      {heading.trim() && <Heading style={headingStyle}>{heading}</Heading>}
      {body?.trim() && <p style={pStyle}>{body}</p>}
    </>
  )
}

/** A heading + HTML-bodied block, for copy that needs inline links. */
function HtmlBlock({ heading, html, level = 3 }: { heading: string; html: string; level?: 2 | 3 }) {
  if (!heading.trim() && !html.trim()) return null
  const Heading = level === 2 ? 'h2' : 'h3'
  const headingStyle = level === 2 ? h2Style : h3Style
  return (
    <>
      {heading.trim() && <Heading style={headingStyle}>{heading}</Heading>}
      {html.trim() && <p style={pStyle} dangerouslySetInnerHTML={{ __html: html }} />}
    </>
  )
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={thStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, j) => (
                <td key={j} style={j === 0 ? rowHeadStyle : tdStyle}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AboutPage() {
  const { data: settings, isLoading } = useSettings()
  const t = useText()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2px solid var(--border)',
          borderTopColor: 'var(--primary)',
          animation: 'spin .8s linear infinite',
        }} />
      </div>
    )
  }

  const vectorTableHtml = t('about.vectorTable.html')
  const assayTableHtml = t('about.assayTable.html')
  // The app's own path (VITE_BASE), e.g. "/v2" — never hard-coded, so links
  // work on a deployment served anywhere.
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')

  const usefulLinks: { labelKey: string; descKey: string; to?: string; href?: string }[] = [
    { labelKey: 'about.links.search.label', descKey: 'about.links.search.desc', to: '/search' },
    { labelKey: 'about.links.downloads.label', descKey: 'about.links.downloads.desc', to: '/download' },
    // The documentation site is built into the same image and served beside
    // the app at <base>/docs/, so it is a plain link, not a client route.
    { labelKey: 'about.links.docs.label', descKey: 'about.links.docs.desc', href: `${base}/docs/` },
    { labelKey: 'about.links.developer.label', descKey: 'about.links.developer.desc', to: '/developer' },
    { labelKey: 'about.links.swagger.label', descKey: 'about.links.swagger.desc', href: `${base}/api/docs/` },
    { labelKey: 'about.links.schema.label', descKey: 'about.links.schema.desc', href: `${base}/api/schema/` },
    {
      labelKey: 'about.links.psicquic.label',
      descKey: 'about.links.psicquic.desc',
      href: `${base}/psicquic/rest/query?q=BRCA1&format=tab25`,
    },
    { labelKey: 'about.links.faq.label', descKey: 'about.links.faq.desc', to: '/faq' },
    { labelKey: 'about.links.contact.label', descKey: 'about.links.contact.desc', to: '/contact' },
  ]

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 32px 80px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--text)', margin: '0 0 32px' }}>
        {t('about.title', { title: settings?.title ?? 'openPIP' })}
      </h1>

      {settings?.about ? (
        <div
          style={{ lineHeight: 1.7, fontSize: 14, color: 'var(--text)' }}
          dangerouslySetInnerHTML={{ __html: settings.about }}
        />
      ) : (
        <p style={pStyle}>{t('about.fallbackIntro')}</p>
      )}

      {/* ── Proteome-scale efforts ── */}
      <Block heading={t('about.proteomeScale.heading')} />
      <Block heading={t('about.hi105.heading')} body={t('about.hi105.body')} level={3} />
      <Block heading={t('about.hi214.heading')} body={t('about.hi214.body')} level={3} />
      <Block heading={t('about.huri.heading')} body={t('about.huri.body')} level={3} />
      <Block heading={t('about.hiUnion.heading')} body={t('about.hiUnion.body')} level={3} />

      {/* ── Other efforts ── */}
      <Block heading={t('about.otherEfforts.heading')} />
      <Block
        heading={t('about.venkatesan09.heading')}
        body={t('about.venkatesan09.body')}
        level={3}
      />
      <Block heading={t('about.yu11.heading')} body={t('about.yu11.body')} level={3} />
      <Block heading={t('about.yang16.heading')} body={t('about.yang16.body')} level={3} />
      <Block heading={t('about.testSpace.heading')} body={t('about.testSpace.body')} level={3} />

      {/* ── Literature ── */}
      <Block heading={t('about.literature.heading')} />
      <Block heading={t('about.litbm.heading')} body={t('about.litbm.body')} level={3} />

      {/* ── Dataset citations (rendered from the database, editable per dataset) ── */}
      <DatasetCitations
        heading={t('about.datasetCitations.heading')}
        intro={t('about.datasetCitations.intro')}
      />

      {/* ── Screening pipeline ── */}
      <Block heading={t('about.pipeline.heading')} body={t('about.pipeline.body')} />

      {/* ── Vector details ── */}
      {t('about.vectorTable.heading').trim() && (
        <h3 style={h3Style}>{t('about.vectorTable.heading')}</h3>
      )}
      {vectorTableHtml.trim() ? (
        <div style={{ overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: vectorTableHtml }} />
      ) : (
        <DataTable headers={VECTOR_HEADERS} rows={VECTOR_ROWS} />
      )}

      {/* ── Y2H assay versions ── */}
      {t('about.assayTable.heading').trim() && (
        <h3 style={h3Style}>{t('about.assayTable.heading')}</h3>
      )}
      {t('about.assayTable.intro').trim() && <p style={pStyle}>{t('about.assayTable.intro')}</p>}
      {t('about.assayTable.note').trim() && <p style={pStyle}>{t('about.assayTable.note')}</p>}
      {assayTableHtml.trim() ? (
        <div style={{ overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: assayTableHtml }} />
      ) : (
        <DataTable headers={ASSAY_HEADERS} rows={ASSAY_ROWS} />
      )}

      {/* ── Options ── */}
      <Block heading={t('about.searchOptions.heading')} body={t('about.searchOptions.body')} />
      <Block heading={t('about.filterOptions.heading')} />
      <Block
        heading={t('about.confidenceScore.heading')}
        body={t('about.confidenceScore.body')}
        level={3}
      />
      {t('about.confidenceScore.body2').trim() && (
        <p style={pStyle}>{t('about.confidenceScore.body2')}</p>
      )}
      <Block
        heading={t('about.interactionStatus.heading')}
        body={t('about.interactionStatus.body')}
        level={3}
      />
      <Block
        heading={t('about.tissueExpression.heading')}
        body={t('about.tissueExpression.body')}
        level={3}
      />
      <Block heading={t('about.exportOptions.heading')} body={t('about.exportOptions.body')} />
      <Block heading={t('about.saveOptions.heading')} body={t('about.saveOptions.body')} />
      <Block heading={t('about.requirements.heading')} body={t('about.requirements.body')} />

      {/* ── Programmatic access ── */}
      <Block heading={t('about.programmatic.heading')} body={t('about.programmatic.body')} />
      <HtmlBlock heading={t('about.restApi.heading')} html={t('about.restApi.body', { base })} />
      <Block heading={t('about.deepLinks.heading')} body={t('about.deepLinks.body')} level={3} />
      {t('about.deepLinks.examples', { base }).trim() && (
        <div style={{ background: 'var(--surface-2)', borderRadius: 6, padding: '10px 16px', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', marginBottom: 12 }}>
          {parseLines(t('about.deepLinks.examples', { base })).map((url) => (
            <div key={url}>{url}</div>
          ))}
        </div>
      )}
      <HtmlBlock heading={t('about.sdk.heading')} html={t('about.sdk.body')} />
      <HtmlBlock heading={t('about.psicquic.heading')} html={t('about.psicquic.body', { base })} />
      {t('about.programmatic.footer').trim() && (
        <p style={pStyle} dangerouslySetInnerHTML={{ __html: t('about.programmatic.footer') }} />
      )}

      {/* ── Useful links ── */}
      <Block heading={t('about.usefulLinks.heading')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 8 }}>
        {usefulLinks.map(({ labelKey, descKey, to, href }) => (
          <div key={labelKey} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
            {to ? (
              <Link to={to} style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                {t(labelKey)}
              </Link>
            ) : (
              <ExternalLink href={href!}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{t(labelKey)}</span>
              </ExternalLink>
            )}
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {t(descKey)}
            </p>
          </div>
        ))}
      </div>

      {/* ── Acknowledgments ── */}
      <Block
        heading={t('about.acknowledgments.heading')}
        body={t('about.acknowledgments.body')}
      />

      {/* ── Footer metadata ── */}
      {(settings?.version || settings?.url) && (
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-soft)' }}>
          {settings.version && (
            <span>
              {t('about.versionPrefix')} {settings.version}
            </span>
          )}
          {settings.version && settings.url && <span> · </span>}
          {settings.url && <ExternalLink href={settings.url}>{settings.url}</ExternalLink>}
        </div>
      )}
    </div>
  )
}
