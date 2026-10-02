import type { TextGroup } from '../types'

export const documentationGroup: TextGroup = {
  id: 'documentation',
  label: 'Documentation page',
  route: '/documentation',
  description: 'User guide for the web interface. Previously not editable at all.',
  entries: [
    {
      key: 'docs.title',
      label: 'Page title',
      section: 'Page header',
      default: 'Documentation',
    },

    {
      key: 'docs.searching.heading',
      label: 'Heading',
      section: 'Searching',
      default: 'Searching',
    },
    {
      key: 'docs.searching.body',
      label: 'Body',
      section: 'Searching',
      kind: 'multiline',
      default:
        'Enter one or more gene names, UniProt IDs, or Ensembl IDs separated by commas, spaces, or newlines. The database will return all known interactions involving your query proteins.',
    },
    {
      key: 'docs.searching.examplesHeading',
      label: 'Examples heading',
      section: 'Searching',
      default: 'Example queries',
    },
    {
      key: 'docs.searching.examples',
      label: 'Example list',
      section: 'Searching',
      kind: 'multiline',
      default:
        'BAD | single protein\nBAD,BCL2L1,BAK1 | multiple proteins\nQ92934 | UniProt accession',
      hint: 'One item per line, formatted as "code | description". The code part is shown in a monospaced chip.',
    },

    {
      key: 'docs.filtering.heading',
      label: 'Heading',
      section: 'Filtering results',
      default: 'Filtering Results',
    },
    {
      key: 'docs.filtering.body',
      label: 'Body',
      section: 'Filtering results',
      kind: 'multiline',
      default: 'Use the filter controls beside the results to narrow them by:',
    },
    {
      key: 'docs.filtering.items',
      label: 'List',
      section: 'Filtering results',
      kind: 'multiline',
      default:
        'Score threshold | minimum interaction confidence score (0–1)\nEvidence category | the interaction categories present in the results\nTissue | proteins expressed in every selected tissue\nFilter mode | all interactions, only query↔query, or only interactions involving a query protein',
      hint: 'One item per line, formatted as "term | description". The term is shown in bold.',
    },

    {
      key: 'docs.downloading.heading',
      label: 'Heading',
      section: 'Downloading data',
      default: 'Downloading Data',
    },
    {
      key: 'docs.downloading.body',
      label: 'Body',
      section: 'Downloading data',
      kind: 'multiline',
      default:
        'After running a search, open the Download section beside the results. No account is needed. Files contain all results of the search, whatever filters are applied. Available formats:',
    },
    {
      key: 'docs.downloading.items',
      label: 'Format list',
      section: 'Downloading data',
      kind: 'multiline',
      default:
        'SIF | Simple Interaction Format (tab-separated: A pp B)\nInteractions CSV | one row per interaction: identifiers, query status, score, category and dataset\nInteractors CSV | protein metadata as comma-separated values\nFASTA | protein sequences\nPSI-MI | PSI-MI TAB with 42 columns (2.7 layout), identifiers and scores filled in\nNetwork image | the network as drawn, as PNG or JPG\nAll datasets | every dataset in one ZIP file',
      hint: 'One item per line, formatted as "term | description". The term is shown in bold.',
    },

    {
      key: 'docs.network.heading',
      label: 'Heading',
      section: 'Network visualization',
      default: 'Network Visualization',
    },
    {
      key: 'docs.network.body',
      label: 'Body',
      section: 'Network visualization',
      kind: 'multiline',
      default:
        'Results are displayed as an interactive network. Use the Layout button to switch between force-directed (Cola, CoSE), concentric, circle, and grid layouts. Click any node or edge to see details. Scroll to zoom, drag to pan.',
    },
  ],
}
