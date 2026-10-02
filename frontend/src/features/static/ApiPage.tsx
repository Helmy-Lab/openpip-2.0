import { useText, parsePipeList } from '../../text'
import { useSettings } from '../../api/settings'
import { apiBase } from '../../lib/apiBase'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-main)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre
      className="rounded-lg p-4 text-sm overflow-x-auto mb-4"
      style={{ background: 'var(--color-surface, #f3f4f6)', color: 'var(--color-text, #111)' }}
    >
      <code>{children.trim()}</code>
    </pre>
  )
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded mr-2"
      style={{ background: color, color: '#fff' }}
    >
      {label}
    </span>
  )
}

function EndpointRow({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = { GET: '#16a34a', POST: '#2563eb', DELETE: '#dc2626' }
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-100 text-sm">
      <Tag label={method} color={colors[method] ?? '#555'} />
      <code
        className="font-mono text-xs px-2 py-0.5 rounded w-72 shrink-0"
        style={{ background: 'var(--color-surface, #f3f4f6)' }}
      >
        {path}
      </code>
      <span className="text-gray-500">{desc}</span>
    </div>
  )
}

export function ApiPage() {
  const t = useText()
  const { data: settings } = useSettings()
  const BASE = apiBase(settings?.url)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-main)' }}>
        {t('api.title')}
      </h1>
      <p className="text-gray-500 mb-8">{t('api.intro')}</p>

      {/* ── 1. Deep links ── */}
      <Section title={t('api.deepLinks.heading')}>
        <p className="text-gray-600 mb-3 text-sm">{t('api.deepLinks.body')}</p>
        <Code>{`
# Search by gene name or UniProt ID
${BASE}/search/BRCA1
${BASE}/search/BRCA1,TP53,MYC

# Protein detail page
${BASE}/protein/BRCA1
${BASE}/protein/P38398
${BASE}/protein/ENSG00000012048
        `}</Code>
        <p className="text-gray-500 text-sm">{t('api.deepLinks.buttonNote')}</p>
        <Code>{`<a href="${BASE}/protein/BRCA1">View BRCA1 in openPIP</a>`}</Code>
      </Section>

      {/* ── 2. REST API ── */}
      <Section title={t('api.rest.heading')}>
        <p className="text-gray-600 mb-4 text-sm">
          {t('api.rest.body')}{' '}
          <a
            href={`${BASE}/api/docs/`}
            target="_blank"
            rel="noreferrer"
            className="underline"
            style={{ color: 'var(--color-main)' }}
          >
            {BASE}/api/docs/
          </a>
        </p>

        <h3 className="font-medium text-gray-800 mb-2 text-sm">{t('api.rest.endpointsHeading')}</h3>
        <div className="mb-6">
          <EndpointRow method="GET" path="/api/search?q=BRCA1" desc={t('api.rest.searchDesc')} />
          <EndpointRow method="GET" path="/api/proteins/{identifier}" desc={t('api.rest.proteinDesc')} />
          <EndpointRow method="GET" path="/api/counts" desc={t('api.rest.countsDesc')} />
          <EndpointRow method="GET" path="/api/datasets" desc={t('api.rest.datasetsDesc')} />
          <EndpointRow method="GET" path="/api/datasets/{id}/download" desc={t('api.rest.datasetDownloadDesc')} />
          <EndpointRow method="GET" path="/api/announcements" desc={t('api.rest.announcementsDesc')} />
        </div>

        <h3 className="font-medium text-gray-800 mb-2 text-sm">{t('api.rest.jsHeading')}</h3>
        <Code>{`
// Search
const res = await fetch('${BASE}/api/search?q=BRCA1');
const data = await res.json();
data.all_proteins.forEach(p => console.log(p.protein_gene_name, p.protein_uniprot_id));

// Multi-protein search
const res = await fetch('${BASE}/api/search?q=BRCA1,TP53');
const shared = data.all_proteins.filter(p =>
  data.query_protein_id_array.includes(p.protein_id)
);

// Protein detail
const res = await fetch('${BASE}/api/proteins/BRCA1');
const protein = await res.json();
console.log(protein.protein_description);

// Database counts
const { proteins, interactions } = await (
  await fetch('${BASE}/api/counts')
).json();
        `}</Code>

        <h3 className="font-medium text-gray-800 mb-2 text-sm">{t('api.rest.pythonHeading')}</h3>
        <Code>{`
import requests

BASE = '${BASE}'

# Search
r = requests.get(f'{BASE}/api/search', params={'q': 'BRCA1'})
proteins = r.json()['all_proteins']
print(proteins[0]['protein_gene_name'])  # BRCA1

# Protein detail
r = requests.get(f'{BASE}/api/proteins/P38398')
print(r.json()['protein_description'][:80])
        `}</Code>

        <h3 className="font-medium text-gray-800 mb-2 text-sm">{t('api.rest.curlHeading')}</h3>
        <Code>{`
curl '${BASE}/api/search?q=BRCA1' | python3 -m json.tool
curl '${BASE}/api/proteins/BRCA1'
curl '${BASE}/api/counts'
        `}</Code>
      </Section>

      {/* ── 3. Python ── */}
      {/* No openPIP Python package is published (one was started and shelved), so this shows
          the REST API from plain Python rather than an SDK no one can install. */}
      <Section title={t('api.sdk.heading')}>
        <p className="text-gray-600 mb-3 text-sm">{t('api.sdk.body')}</p>
        <Code>{`
import requests

result = requests.get('${BASE}/api/search', params={'q': 'BRCA1,TP53'}).json()
for p in result['all_proteins']:
    print(p['protein_gene_name'], p['protein_uniprot_id'])

# The same interactions as PSI-MI TAB 2.5, from PSICQUIC
tab = requests.get('${BASE}/psicquic/rest/query', params={'q': 'id:BRCA1'}).text
        `}</Code>
      </Section>

      {/* ── 4. PSICQUIC ── */}
      <Section title={t('api.psicquic.heading')}>
        <p
          className="text-gray-600 mb-3 text-sm"
          dangerouslySetInnerHTML={{ __html: t('api.psicquic.body') }}
        />
        <Code>{`
# Base URL
${BASE}/psicquic/rest/query

# Examples
curl '${BASE}/psicquic/rest/query?q=BRCA1&format=tab25'
curl '${BASE}/psicquic/rest/query?q=idA:P38398&format=json'
curl '${BASE}/psicquic/rest/query?q=taxidA:9606&maxResults=100&format=tab25'
        `}</Code>

        <h3 className="font-medium text-gray-800 mb-2 text-sm">{t('api.psicquic.miqlHeading')}</h3>
        <div className="text-sm">
          {parsePipeList(t('api.psicquic.miqlRows')).map(({ term, description }) => (
            <div key={term} className="flex gap-4 py-1.5 border-b border-gray-100">
              <code
                className="px-2 py-0.5 rounded text-xs w-44 shrink-0"
                style={{ background: 'var(--color-surface, #f3f4f6)' }}
              >
                {term}
              </code>
              <span className="text-gray-500">{description}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 5. Cite ── */}
      <Section title={t('api.cite.heading')}>
        <p className="text-gray-600 text-sm">{t('api.cite.body')}</p>
        <Code>{t('api.cite.reference')}</Code>
      </Section>
    </div>
  )
}
