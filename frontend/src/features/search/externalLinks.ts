import type { Protein, Interaction } from '../../types/api'
import biogridIcon from '../../assets/tools/biogrid.png'
import cbioportalIcon from '../../assets/tools/cbioportal.png'
import complexportalIcon from '../../assets/tools/complexportal.svg'
import davidIcon from '../../assets/tools/david.png'
import drugstoneIcon from '../../assets/tools/drugstone.png'
import genelistIcon from '../../assets/tools/genelist.svg'
import genemaniaIcon from '../../assets/tools/genemania.png'
import gprofilerIcon from '../../assets/tools/gprofiler.png'
import intactIcon from '../../assets/tools/intact.svg'
import keggIcon from '../../assets/tools/kegg.png'
import pathwaycommonsIcon from '../../assets/tools/pathwaycommons.png'
import reactomeIcon from '../../assets/tools/reactome.png'
import stringIcon from '../../assets/tools/string.png'
import uniprotIcon from '../../assets/tools/uniprot.png'

export interface ExternalLink {
  id: string
  label: string
  /** Bundled favicon/logo of the tool. */
  icon: string
  href?: string
  onClick?: () => void
}

export function buildLinks(
  allProteins: Protein[],
  queryProteinIds: number[],
  allInteractions: Interaction[] = []
): ExternalLink[] {
  const genes = allProteins.map((p) => p.protein_gene_name)
  const queryGenes = allProteins
    .filter((p) => queryProteinIds.includes(p.protein_id))
    .map((p) => p.protein_gene_name)
  const entrezIds = allProteins.map((p) => p.protein_entrez_id).filter(Boolean)

  const gProfilerUrl =
    'https://biit.cs.ut.ee/gprofiler/index.cgi?organism=hsapiens&query=' +
    genes.map((g) => encodeURIComponent(g)).join('+')

  const geneManiaUrl =
    'http://genemania.org/search/human/' + genes.map((g) => encodeURIComponent(g)).join('%7C')

  const pathwayCommonsUrl =
    'http://www.pathwaycommons.org/pcviz/#pathsbetween/' + genes.join(',')

  const davidUrl =
    'http://david.abcc.ncifcrf.gov/api.jsp?type=ENTREZ_GENE_ID&ids=' +
    entrezIds.join(',') +
    '&tool=summary'

  const stringUrl =
    'http://string-db.org/newstring_cgi/show_network_section.pl?identifiers=' +
    genes.map((g) => encodeURIComponent(g)).join('%0D') +
    '&species=9606'

  const cBioPortalUrl =
    'http://www.cbioportal.org/ln?q=' + genes.map((g) => encodeURIComponent(g)).join('+')

  const complexPortalUrl =
    'http://www.ebi.ac.uk/complexportal/complex/search?query=' +
    genes.map((g) => encodeURIComponent(g)).join('+')

  const intActUrl =
    'http://www.ebi.ac.uk/intact/query/' +
    queryGenes.map((g) => encodeURIComponent(g)).join('+')

  const biogridUrl =
    'https://thebiogrid.org/search.php?search=' +
    queryGenes.map((g) => encodeURIComponent(g)).join('+') +
    '&organism=9606'

  const keggUrl =
    'https://www.genome.jp/dbget-bin/www_bget?' +
    queryGenes.map((g) => `hsa:${encodeURIComponent(g)}`).join('+')

  const uniprotUrl =
    'https://www.uniprot.org/uniprotkb?query=(' +
    queryGenes.map((g) => `gene:${encodeURIComponent(g)}`).join('+OR+') +
    ')+AND+organism_id:9606'

  const geneListUrl =
    'https://www.gene-list.com/search/' + genes.map((g) => encodeURIComponent(g)).join(',')

  // Drugst.One takes the whole network: gene names as nodes, "A B" pairs as
  // edges. autofillEdges=false keeps it from adding interactions of its own —
  // what is shown should be what openPIP found.
  // ponytail: the network goes in the URL, so a few thousand interactions will
  // outgrow what a browser or their server accepts. Post a form if that lands.
  const drugstOneUrl =
    'https://drugst.one/standalone?nodes=' +
    genes.map((g) => encodeURIComponent(g)).join(',') +
    '&edges=' +
    allInteractions
      .map((ix) =>
        encodeURIComponent(
          `${ix.interactor_A.protein_gene_name} ${ix.interactor_B.protein_gene_name}`
        )
      )
      .join(',') +
    '&autofillEdges=false'

  async function openReactome() {
    try {
      const body = '#Genes\n' + genes.join('\n')
      const res = await fetch('https://reactome.org/AnalysisService/identifiers/', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
      })
      const data = await res.json()
      const token = data?.summary?.token
      if (token) {
        window.open(
          `https://reactome.org/PathwayBrowser/#DTAB=AN&ANALYSIS=${token}`,
          '_blank',
          'noopener,noreferrer'
        )
      } else {
        window.open('https://reactome.org', '_blank', 'noopener,noreferrer')
      }
    } catch {
      window.open('https://reactome.org', '_blank', 'noopener,noreferrer')
    }
  }

  return [
    { id: 'gprofiler', label: 'gProfiler', icon: gprofilerIcon, href: gProfilerUrl },
    { id: 'reactome', label: 'Reactome', icon: reactomeIcon, onClick: openReactome },
    { id: 'genemania', label: 'GeneMania', icon: genemaniaIcon, href: geneManiaUrl },
    { id: 'pathwaycommons', label: 'Pathway Commons', icon: pathwaycommonsIcon, href: pathwayCommonsUrl },
    { id: 'david', label: 'DAVID', icon: davidIcon, href: davidUrl },
    { id: 'string', label: 'STRING', icon: stringIcon, href: stringUrl },
    { id: 'cbioportal', label: 'cBioPortal', icon: cbioportalIcon, href: cBioPortalUrl },
    { id: 'complexportal', label: 'Complex Portal', icon: complexportalIcon, href: complexPortalUrl },
    { id: 'intact', label: 'IntAct (Query)', icon: intactIcon, href: intActUrl },
    { id: 'biogrid', label: 'BioGRID', icon: biogridIcon, href: biogridUrl },
    { id: 'kegg', label: 'KEGG', icon: keggIcon, href: keggUrl },
    { id: 'uniprot', label: 'UniProt', icon: uniprotIcon, href: uniprotUrl },
    { id: 'drugstone', label: 'Drugst.One', icon: drugstoneIcon, href: drugstOneUrl },
    { id: 'genelist', label: 'Gene List', icon: genelistIcon, href: geneListUrl },
  ]
}

/** White chip keeps the dark logos (GeneMANIA, DAVID) legible in dark mode;
 * the ring outlines it on light surfaces. 18px of logo = the 36px assets at 2x. */
export const LINK_ICON_STYLE = {
  width: 20,
  height: 20,
  flexShrink: 0,
  objectFit: 'contain' as const,
  background: '#fff',
  borderRadius: 4,
  padding: 1,
  boxSizing: 'border-box' as const,
  boxShadow: '0 0 0 1px var(--border)',
}
