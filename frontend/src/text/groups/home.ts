import type { TextGroup } from '../types'

export const homeGroup: TextGroup = {
  id: 'home',
  label: 'Home page',
  route: '/',
  description: 'Everything a visitor reads on the landing page, in the order it appears.',
  entries: [
    {
      key: 'home.hero.headline',
      label: 'Headline',
      section: 'Hero',
      kind: 'html',
      default:
        'The protein <span class="op-accent">interaction network</span>,<br />made queryable.',
      hint: 'Inline HTML allowed. Use <span class="op-accent"> to highlight words in the theme colour, and <br /> for a line break.',
    },
    {
      key: 'home.hero.subhead',
      label: 'Sub-headline',
      section: 'Hero',
      kind: 'multiline',
      default:
        'Search proteins across verified interactions from the CCSB Human Interactome, visualized, filterable, and ready to export.',
    },

    {
      key: 'home.mission.heading',
      allowBlank: true,
      label: 'Heading',
      section: 'Our Mission',
      default: '<h4>Our Mission</h4>',
      hint: 'HTML allowed. Clear this and the body to hide the whole Mission block from the page.',
    },
    {
      key: 'home.mission.body',
      allowBlank: true,
      label: 'Body',
      section: 'Our Mission',
      kind: 'html',
      default: '<p>openPIP provides a curated map of protein–protein interactions (PPI).</p>',
    },

    {
      key: 'home.cards.heading',
      label: 'Section heading',
      section: 'Three ways to start',
      default: 'Three ways to start',
    },
    {
      key: 'home.cards.search.title',
      label: 'Card 1 title',
      section: 'Three ways to start',
      default: 'Search by gene',
    },
    {
      key: 'home.cards.search.desc',
      label: 'Card 1 description',
      section: 'Three ways to start',
      kind: 'multiline',
      default: 'Enter a UniProt or HGNC identifier: find every protein it touches.',
    },
    {
      key: 'home.cards.browse.title',
      label: 'Card 2 title',
      section: 'Three ways to start',
      default: 'Browse the encyclopedia',
    },
    {
      key: 'home.cards.browse.desc',
      label: 'Card 2 description',
      section: 'Three ways to start',
      kind: 'multiline',
      default: 'Every protein in openPIP, with its structure, annotations and interactors.',
    },
    {
      key: 'home.cards.download.title',
      label: 'Card 3 title',
      section: 'Three ways to start',
      default: 'Bulk download',
    },
    {
      key: 'home.cards.download.desc',
      label: 'Card 3 description',
      section: 'Three ways to start',
      kind: 'multiline',
      default: 'PSI-MI tab, SIF, CSV: pick your format and pull the whole dataset.',
    },

    {
      key: 'home.methods.heading',
      allowBlank: true,
      label: 'Heading',
      section: 'Methods',
      default: '<h4>Methods</h4>',
      hint: 'HTML allowed. Clear this and the body to hide the whole Methods block from the page.',
    },
    {
      key: 'home.methods.body',
      allowBlank: true,
      label: 'Body',
      section: 'Methods',
      kind: 'html',
      default: '<p>Interactions are sourced from published experimental datasets.</p>',
    },

    {
      key: 'home.news.heading',
      label: 'Panel heading',
      section: 'News',
      default: 'News',
    },

    {
      key: 'home.cite.heading',
      label: 'Panel heading',
      section: 'Cite openPIP',
      default: 'Cite openPIP',
    },
    {
      key: 'home.cite.body',
      label: 'Body',
      section: 'Cite openPIP',
      kind: 'multiline',
      default:
        'If openPIP supports your research, please cite the platform and the underlying source datasets.',
    },
    {
      key: 'home.cite.bibtex',
      label: 'BibTeX entry',
      section: 'Cite openPIP',
      kind: 'multiline',
      default:
        '@article{helmy2022openpip, title={openPIP}, journal={Journal of Molecular Biology}, year={2022}}',
      hint: 'Copied to the clipboard when a visitor clicks Copy BibTeX.',
    },
    {
      key: 'home.cite.copyButton',
      label: 'Copy button',
      section: 'Cite openPIP',
      default: 'Copy BibTeX',
    },
    {
      key: 'home.cite.learnMore',
      label: 'Learn more link',
      section: 'Cite openPIP',
      default: 'Learn more',
    },

    // Chrome: real copy, but rarely edited, so the editor keeps it out of the way.
    {
      key: 'home.hero.searchPlaceholder',
      label: 'Search box placeholder',
      default: 'Search by gene names, e.g. BAD, BCL2L1',
    },
    {
      key: 'home.hero.searchLabel',
      label: 'Search box accessible label',
      default: 'Search proteins and interactions',
    },
    {
      key: 'home.hero.searchButton',
      label: 'Search button',
      default: 'Search',
    },
    {
      key: 'home.hero.willSearch',
      label: 'Query preview prefix',
      section: 'Hero',
      default: 'Will search',
    },
    {
      key: 'home.hero.cannotFilter',
      label: 'Query preview: unsupported filter notice',
      section: 'Hero',
      default: 'Cannot filter by:',
    },
    {
      key: 'home.hero.examplesLabel',
      label: 'Example queries label',
      default: 'Try:',
    },
    {
      key: 'home.stats.proteins',
      label: 'Stat label: proteins',
      default: 'Proteins indexed',
    },
    {
      key: 'home.stats.interactions',
      label: 'Stat label: interactions',
      default: 'Verified interactions',
    },
    {
      key: 'home.stats.datasets',
      label: 'Stat label: datasets',
      default: 'Source datasets',
    },
    {
      key: 'home.news.empty',
      label: 'News panel empty state',
      default: 'No announcements.',
    },
    {
      key: 'home.cite.copiedButton',
      label: 'Copy BibTeX confirmation',
      default: 'Copied',
    },
    {
      key: 'home.network.heading',
      label: 'Example network: panel heading',
      default: 'Example network',
    },
    {
      key: 'home.network.neighborhood',
      label: 'Example network: subtitle',
      default: '- {gene} neighborhood',
      hint: 'Use {gene} to insert the gene at the centre of the example network.',
    },
    {
      key: 'home.network.viewAnother',
      label: 'Example network: shuffle button',
      default: 'View another',
    },
    {
      key: 'home.network.loading',
      label: 'Example network: loading state',
      default: 'Loading…',
    },
  ],
}
