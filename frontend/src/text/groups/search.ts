import type { TextGroup } from '../types'

/**
 * Search-results UI copy: sidebar controls, result tabs, info panels, modals.
 *
 * Deliberately excluded, because they are data rather than copy: PSI-MI
 * controlled-vocabulary method names in EdgeInfoPanel, the GTEx tissue list,
 * and the names of external resources (UniProt, Ensembl, NCBI Gene).
 */
export const searchGroup: TextGroup = {
  id: 'search',
  label: 'Search results',
  route: '/search',
  description:
    'Sidebar filters, result tabs, node/edge detail panels, and download modals. Node and edge colours are set under Search above.',
  entries: [
    {
      key: 'search.sidebar.query',
      label: 'Query heading',
      section: 'Sidebar',
      default: 'Query',
    },
    {
      key: 'search.sidebar.searchButton',
      label: 'Search button',
      section: 'Sidebar',
      default: 'Search',
    },
    {
      key: 'search.sidebar.examples',
      label: 'Examples heading',
      section: 'Sidebar',
      default: 'Examples',
    },
    {
      key: 'search.sidebar.score',
      label: 'Score heading',
      section: 'Sidebar',
      default: 'Min. confidence score',
    },
    {
      key: 'search.sidebar.found',
      label: 'Found label',
      section: 'Sidebar',
      default: 'Found:',
    },
    {
      key: 'search.sidebar.notFound',
      label: 'Not-found label',
      section: 'Sidebar',
      default: 'Not found:',
    },
    {
      key: 'search.sidebar.sources',
      label: 'Sources heading',
      section: 'Sidebar',
      default: 'Interaction sources',
    },
    {
      key: 'search.sidebar.tools',
      label: 'Tools heading',
      section: 'Sidebar',
      default: 'Tools',
    },
    {
      key: 'search.sidebar.layout',
      label: 'Layout section',
      section: 'Sidebar',
      default: 'Layout',
    },
    {
      key: 'search.sidebar.filterMode',
      label: 'Filter mode section',
      section: 'Sidebar',
      default: 'Filter mode',
    },
    {
      key: 'search.sidebar.tissue',
      label: 'Tissue section',
      section: 'Sidebar',
      default: 'Tissue expression',
    },
    {
      key: 'search.sidebar.allTissues',
      label: 'Clear tissue selection button',
      section: 'Sidebar',
      default: 'All tissues',
    },
    {
      key: 'search.sidebar.tissueNodeSize',
      label: 'Tissue expression node-size switch',
      section: 'Sidebar',
      default: 'Show tissue expression',
    },
    {
      key: 'search.sidebar.tissueNodeColor',
      label: 'Tissue specificity node-color switch',
      section: 'Sidebar',
      default: 'Reflect tissue specificity',
    },
    {
      key: 'search.sidebar.noTissueData',
      label: 'Tissue section empty state',
      section: 'Sidebar',
      default: 'No tissue expression data for these results.',
    },
    {
      key: 'search.sidebar.summary',
      label: 'Summary section',
      section: 'Sidebar',
      default: 'Summary',
    },
    {
      key: 'search.sidebar.download',
      label: 'Download section',
      section: 'Sidebar',
      default: 'Download',
    },
    {
      key: 'search.sidebar.externalLinks',
      label: 'External links section',
      section: 'Sidebar',
      default: 'External links',
    },

    {
      key: 'search.summary.proteins',
      label: 'Proteins',
      section: 'Summary stats',
      default: 'Proteins:',
    },
    {
      key: 'search.summary.interactions',
      label: 'Interactions',
      section: 'Summary stats',
      default: 'Interactions:',
    },
    {
      key: 'search.summary.avgDegree',
      label: 'Average degree',
      section: 'Summary stats',
      default: 'Avg. node degree:',
    },

    {
      key: 'search.layout.cola',
      label: 'Cola',
      section: 'Layout options',
      default: 'Force-directed (Cola)',
    },
    {
      key: 'search.layout.cose',
      label: 'CoSE',
      section: 'Layout options',
      default: 'Force-directed (CoSE)',
    },
    {
      key: 'search.layout.concentric',
      label: 'Concentric',
      section: 'Layout options',
      default: 'Concentric',
    },
    {
      key: 'search.layout.circle',
      label: 'Circle',
      section: 'Layout options',
      default: 'Circle',
    },
    {
      key: 'search.layout.grid',
      label: 'Grid',
      section: 'Layout options',
      default: 'Grid',
    },
    {
      key: 'search.layout.background',
      label: 'Canvas background',
      section: 'Layout options',
      default: 'Background',
    },
    {
      key: 'search.layout.backgroundReset',
      label: 'Reset canvas background',
      section: 'Layout options',
      default: 'Reset to default',
    },

    {
      key: 'search.filterMode.none',
      label: 'No Filter',
      section: 'Filter modes',
      default: 'No Filter',
    },
    {
      key: 'search.filterMode.queryQuery',
      label: 'Query/query',
      section: 'Filter modes',
      default: 'Query-Query',
    },
    {
      key: 'search.filterMode.queryInteractor',
      label: 'Query/interactor',
      section: 'Filter modes',
      default: 'Query-Interactor',
    },

    {
      key: 'search.download.sif',
      label: 'SIF',
      section: 'Download menu',
      default: 'SIF',
    },
    {
      key: 'search.download.interactionsCsv',
      label: 'Interactions CSV',
      section: 'Download menu',
      default: 'Interactions CSV',
    },
    {
      key: 'search.download.interactorsCsv',
      label: 'Interactors CSV',
      section: 'Download menu',
      default: 'Interactors CSV',
    },
    {
      key: 'search.download.fasta',
      label: 'FASTA',
      section: 'Download menu',
      default: 'FASTA',
    },
    {
      key: 'search.download.psimi',
      label: 'PSI-MI',
      section: 'Download menu',
      default: 'PSI-MI',
    },
    {
      key: 'search.download.direct',
      label: 'Direct GZ',
      section: 'Download menu',
      default: 'Direct Download (GZ)',
    },
    {
      key: 'search.download.cytoscape',
      label: 'Open in Cytoscape',
      section: 'Download menu',
      default: 'Open in Cytoscape',
    },

    {
      key: 'search.save.button',
      label: 'Save button',
      section: 'Save network',
      default: 'Save Network',
    },
    {
      key: 'search.save.confirm',
      label: 'Confirm button',
      section: 'Save network',
      default: 'Save',
    },

    {
      key: 'search.share.button',
      label: 'Share button',
      section: 'Share network',
      default: 'Share Network',
    },

    {
      key: 'search.tab.interactions',
      label: 'Interactions',
      section: 'Result tabs',
      default: 'Interactions',
    },
    {
      key: 'search.tab.interactors',
      label: 'Interactors',
      section: 'Result tabs',
      default: 'Interactors',
    },
    {
      key: 'search.tab.goMf',
      label: 'GO molecular function',
      section: 'Result tabs',
      default: 'Molecular Function',
    },
    {
      key: 'search.tab.goBp',
      label: 'GO biological process',
      section: 'Result tabs',
      default: 'Biological Process',
    },
    {
      key: 'search.tab.goCc',
      label: 'GO cellular component',
      section: 'Result tabs',
      default: 'Cellular Component',
    },
    {
      key: 'search.tab.reactome',
      label: 'Reactome',
      section: 'Result tabs',
      default: 'Reactome',
    },
    {
      key: 'search.tab.corum',
      label: 'CORUM',
      section: 'Result tabs',
      default: 'CORUM',
    },
    {
      key: 'search.tab.kegg',
      label: 'KEGG',
      section: 'Result tabs',
      default: 'KEGG',
    },
    {
      key: 'search.tab.subcellular',
      label: 'Subcellular',
      section: 'Result tabs',
      default: 'Subcellular Location',
    },
    {
      key: 'search.tab.tissue',
      label: 'Tissue expression',
      section: 'Result tabs',
      default: 'Tissue Expression',
    },
    {
      key: 'search.tab.summary',
      label: 'Protein info',
      section: 'Result tabs',
      default: 'Protein Info',
    },

    {
      key: 'search.panel.identifiers',
      label: 'Identifiers',
      section: 'Node panel',
      default: 'Identifiers',
    },
    {
      key: 'search.panel.interactions',
      label: 'Interactions',
      section: 'Node panel',
      default: 'Interactions',
    },
    {
      key: 'search.panel.description',
      label: 'Description',
      section: 'Node panel',
      default: 'Description',
    },
    {
      key: 'search.panel.annotations',
      label: 'Annotations',
      section: 'Node panel',
      default: 'Annotations',
    },
    {
      key: 'search.panel.topTissue',
      label: 'Top tissue expression',
      section: 'Node panel',
      default: 'Top Tissue Expression',
    },
    {
      key: 'search.panel.subcellular',
      label: 'Subcellular location',
      section: 'Node panel',
      default: 'Subcellular Location',
    },
    {
      key: 'search.panel.sequence',
      label: 'Sequence',
      section: 'Node panel',
      default: 'Sequence',
    },
    {
      key: 'search.panel.externalDatabases',
      label: 'External databases',
      section: 'Node panel',
      default: 'External Databases',
    },
    {
      key: 'search.panel.actions',
      label: 'Actions',
      section: 'Node panel',
      default: 'Actions',
    },
    {
      key: 'search.panel.links',
      label: 'Links',
      section: 'Node panel',
      default: 'Links',
    },
    {
      key: 'search.panel.interactionCount',
      label: 'Interaction count',
      section: 'Node panel',
      default: 'Number of Interactions',
    },
    {
      key: 'search.panel.inNetwork',
      label: 'In this network',
      section: 'Node panel',
      default: 'In this network',
    },
    {
      key: 'search.panel.inDatabase',
      label: 'In database',
      section: 'Node panel',
      default: 'In database',
    },
    {
      key: 'search.panel.structure',
      label: '3D structure label',
      section: 'Node panel',
      default: '3D Structure',
    },

    {
      key: 'search.edge.score',
      label: 'Confidence score',
      section: 'Edge panel',
      default: 'Confidence Score',
    },
    {
      key: 'search.edge.datasets',
      label: 'Datasets',
      section: 'Edge panel',
      default: 'Datasets',
    },
    {
      key: 'search.edge.experiments',
      label: 'Experiments',
      section: 'Edge panel',
      default: 'Experiments',
    },
    {
      key: 'search.edge.literature',
      label: 'Literature',
      section: 'Edge panel',
      default: 'Literature',
    },
    {
      key: 'search.edge.binary',
      label: 'Binary',
      section: 'Edge panel',
      default: 'Binary',
    },
    {
      key: 'search.edge.nonBinary',
      label: 'Non-binary',
      section: 'Edge panel',
      default: 'Non-Binary',
    },
    {
      key: 'search.edge.dataset',
      label: 'Dataset field',
      section: 'Edge panel',
      default: 'Dataset:',
    },
    {
      key: 'search.edge.dbDomain',
      label: 'DB domain field',
      section: 'Edge panel',
      default: 'DB Domain:',
    },
    {
      key: 'search.edge.ad',
      label: 'AD field',
      section: 'Edge panel',
      default: 'AD:',
    },
    {
      key: 'search.edge.assayVersion',
      label: 'Assay version field',
      section: 'Edge panel',
      default: 'Assay v:',
    },
    {
      key: 'search.edge.screens',
      label: 'Screens field',
      section: 'Edge panel',
      default: 'Screens:',
    },

    // Chrome: placeholders, transient states, and accessible labels.
    {
      key: 'search.sidebar.queryPlaceholder',
      label: 'Sidebar: query placeholder',
      default: 'Gene symbol or UniProt ID',
    },
    {
      key: 'search.sidebar.noProteins',
      label: 'Sidebar: no proteins message',
      default: 'No proteins loaded.',
    },
    {
      key: 'search.save.placeholder',
      label: 'Save network: name placeholder',
      default: 'Network name',
    },
    {
      key: 'search.save.nameRequired',
      label: 'Save network: name required',
      default: 'Name is required',
    },
    {
      key: 'search.save.failed',
      label: 'Save network: failed',
      default: 'Failed to save. Try again.',
    },
    {
      key: 'search.save.success',
      label: 'Save network: success',
      default: 'Saved!',
    },
    {
      key: 'search.save.cancel',
      label: 'Save network: cancel',
      default: 'Cancel',
    },
    {
      key: 'search.panel.close',
      label: 'Panel: close button label',
      default: 'Close',
    },
    {
      key: 'search.error.unreachable',
      label: 'Error: database unreachable',
      default: 'Could not reach the database.',
    },
    {
      key: 'search.error.retry',
      label: 'Error: retry hint',
      default: 'Check your connection and try again.',
    },
    {
      key: 'search.resizeHint',
      label: 'Resize handle tooltip',
      default: 'Drag to resize, click to reset',
    },
    {
      key: 'search.resizeTall',
      label: 'Taller network tooltip',
      default: 'Taller network',
    },
    {
      key: 'search.resizeShort',
      label: 'Shorter network tooltip',
      default: 'Shorter network',
    },
    {
      key: 'search.filter',
      label: 'Canvas filter button',
      default: 'Filter',
    },
    {
      key: 'search.confidence',
      label: 'Canvas confidence button',
      default: 'Confidence',
    },
    {
      key: 'search.fullscreen',
      label: 'Fullscreen button tooltip',
      default: 'Fullscreen',
    },
    {
      key: 'search.fullscreenExit',
      label: 'Exit fullscreen tooltip',
      default: 'Exit fullscreen',
    },
  ],
}
