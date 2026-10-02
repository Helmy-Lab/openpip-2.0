import type { EnrichmentSource } from '../../../api/enrichment'

/**
 * Provenance metadata for the network-view data tabs.
 *
 * Established from the legacy annotation dump rather than assumed:
 *   - `tissue_expression` / `tissue_specificity` use GTEx tissue names
 *     (adipose_visceral_omentum, esophagus_gastroesophageal_junction,
 *     heart_atrial_appendage). Legacy `search_results.js` confirms it in the
 *     filter tooltip: "based on GTEx data". Traced further: GTEx v6.0 processed
 *     with YARN (Paulson et al. 2017) and inherited from HuRI, which is why
 *     there are 36 tissues rather than 54 and why brain is three PCoA clusters
 *     (brain_0/1/2 = basal ganglia / cerebellum / other).
 *     See docs/project/DATA_PROVENANCE_QUESTIONS.md.
 *   - `subcellular_location` uses HPA Cell Atlas compartments and carries the
 *     HPA reliability score per compartment (approved/supported/validated).
 */
export interface SourceInfo {
  name: string
  href: string
  citation: string
}

const GENE_ONTOLOGY: SourceInfo = {
  name: 'Gene Ontology',
  href: 'http://geneontology.org',
  citation: 'Ashburner et al., Nat Genet 2000',
}

export const ENRICHMENT_SOURCE_INFO: Record<EnrichmentSource, SourceInfo> = {
  'GO:MF': GENE_ONTOLOGY,
  'GO:BP': GENE_ONTOLOGY,
  'GO:CC': GENE_ONTOLOGY,
  REAC: { name: 'Reactome', href: 'https://reactome.org', citation: 'Gillespie et al., NAR 2022' },
  CORUM: {
    name: 'CORUM',
    href: 'https://mips.helmholtz-muenchen.de/corum/',
    citation: 'Giurgiu et al., NAR 2019',
  },
  KEGG: {
    name: 'KEGG',
    href: 'https://www.genome.jp/kegg/',
    citation: 'Kanehisa & Goto, NAR 2000',
  },
}

/** The resource a given enrichment tab draws its terms from. */
export function enrichmentDatasetName(source: EnrichmentSource): string {
  return ENRICHMENT_SOURCE_INFO[source].name
}
