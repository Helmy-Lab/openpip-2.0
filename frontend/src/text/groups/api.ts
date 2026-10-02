import type { TextGroup } from '../types'

/**
 * Prose and headings for the API page. The code samples themselves stay in the
 * component: they interpolate the live base URL and are the kind of content
 * that breaks silently if edited by hand.
 */
export const apiGroup: TextGroup = {
  id: 'api',
  label: 'API page',
  route: '/developer',
  description:
    'Headings and prose for the developer access page. Code samples are generated from the site URL and are not editable here.',
  entries: [
    {
      key: 'api.title',
      label: 'Page title',
      section: 'Page header',
      default: 'API & External Access',
    },
    {
      key: 'api.intro',
      label: 'Intro paragraph',
      section: 'Page header',
      kind: 'multiline',
      default:
        'openPIP is fully open, no API key required. Use deep links, the REST API, or the PSICQUIC protocol.',
    },

    {
      key: 'api.deepLinks.heading',
      label: 'Heading',
      section: 'Deep links',
      default: '1. Deep links',
    },
    {
      key: 'api.deepLinks.body',
      label: 'Body',
      section: 'Deep links',
      kind: 'multiline',
      default: 'Link directly to a search or protein page from any website. No code needed.',
    },
    {
      key: 'api.deepLinks.buttonNote',
      label: 'Button example caption',
      section: 'Deep links',
      default: 'Example "View in openPIP" button:',
    },

    {
      key: 'api.rest.heading',
      label: 'Heading',
      section: 'REST API',
      default: '2. REST API',
    },
    {
      key: 'api.rest.body',
      label: 'Body',
      section: 'REST API',
      kind: 'multiline',
      default:
        'Public data (search, proteins, datasets and downloads) needs no login; personal and admin endpoints take a login token. All endpoints accept requests from any browser or server. Interactive docs with a live try-it-out console:',
    },
    {
      key: 'api.rest.endpointsHeading',
      label: 'Endpoints heading',
      section: 'REST API',
      default: 'Public endpoints',
    },
    {
      key: 'api.rest.searchDesc',
      label: 'Endpoint: search',
      section: 'REST API',
      default:
        'Search proteins by gene name, UniProt ID, or Ensembl ID. Comma-separate for multi-protein.',
    },
    {
      key: 'api.rest.proteinDesc',
      label: 'Endpoint: protein detail',
      section: 'REST API',
      default: 'Full protein detail including description, identifiers, and interaction count.',
    },
    {
      key: 'api.rest.countsDesc',
      label: 'Endpoint: counts',
      section: 'REST API',
      default: 'Total proteins, interactions, and datasets in the database.',
    },
    {
      key: 'api.rest.datasetsDesc',
      label: 'Endpoint: datasets',
      section: 'REST API',
      default: 'List all published interaction datasets.',
    },
    {
      key: 'api.rest.datasetDownloadDesc',
      label: 'Endpoint: dataset download',
      section: 'REST API',
      default: 'Download a dataset: tab-separated with its citation (default), or SIF or CSV with ?fmt=sif or ?fmt=csv.',
    },
    {
      key: 'api.rest.announcementsDesc',
      label: 'Endpoint: announcements',
      section: 'REST API',
      default: 'Site announcements.',
    },

    {
      key: 'api.sdk.heading',
      label: 'Heading',
      section: 'Python SDK',
      default: '3. Python',
    },
    {
      key: 'api.sdk.body',
      label: 'Body',
      section: 'Python SDK',
      kind: 'multiline',
      default: 'No openPIP package is needed: call the REST API with the requests library, in scripts or notebooks.',
    },

    {
      key: 'api.psicquic.heading',
      label: 'Heading',
      section: 'PSICQUIC',
      default: '4. PSICQUIC',
    },
    {
      key: 'api.psicquic.body',
      label: 'Body',
      section: 'PSICQUIC',
      kind: 'html',
      default:
        'openPIP implements the <a href="https://psicquic.github.io/">PSICQUIC standard</a>, the same protocol used by BioGRID, IntAct, and STRING. Tools written for those databases can query openPIP with the same requests, for the MIQL fields openPIP supports.',
    },
    {
      key: 'api.psicquic.miqlHeading',
      label: 'MIQL heading',
      section: 'PSICQUIC',
      default: 'MIQL query syntax',
    },
    {
      key: 'api.psicquic.miqlRows',
      label: 'MIQL reference table',
      section: 'PSICQUIC',
      kind: 'multiline',
      default:
        'BRCA1 | Any interaction involving BRCA1\nidA:P38398 | Interactions where interactor A is P38398\nidB:P04637 | Interactions where interactor B is P04637\nid:P38398 | Either interactor is P38398\ntaxidA:9606 | Interactor A is Homo sapiens (NCBI taxon 9606)\n* | All interactions',
      hint: 'One row per line, formatted as "query | description".',
    },

    {
      key: 'api.cite.heading',
      label: 'Heading',
      section: 'Citing openPIP',
      default: '5. Citing openPIP',
    },
    {
      key: 'api.cite.body',
      label: 'Body',
      section: 'Citing openPIP',
      default: 'If you use openPIP in your research, please cite:',
    },
    {
      key: 'api.cite.reference',
      label: 'Reference',
      section: 'Citing openPIP',
      kind: 'multiline',
      default:
        'Helmy M. et al. openPIP: an open-source human protein interaction\ndatabase and analysis platform. J. Mol. Biol. (2022).\nhttps://doi.org/10.1016/j.jmb.2022.167481',
    },

    {
      key: 'api.rest.jsHeading',
      label: 'Code sample heading: JavaScript',
      default: 'JavaScript (browser or Node)',
    },
    {
      key: 'api.rest.pythonHeading',
      label: 'Code sample heading: Python',
      default: 'Python (requests)',
    },
    {
      key: 'api.rest.curlHeading',
      label: 'Code sample heading: curl',
      default: 'curl',
    },
  ],
}
