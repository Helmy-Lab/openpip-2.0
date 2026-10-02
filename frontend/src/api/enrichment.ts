import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export type EnrichmentSource = 'GO:BP' | 'GO:MF' | 'GO:CC' | 'KEGG' | 'REAC' | 'CORUM'

export interface EnrichmentTerm {
  name: string
  source: EnrichmentSource
  p_value: number
  term_id: string
  /** Query genes annotated to this term — what the network highlight lights up. */
  genes: string[]
}

const GPROFILER_SOURCES: EnrichmentSource[] = ['GO:BP', 'GO:MF', 'GO:CC', 'KEGG', 'REAC', 'CORUM']

export function useEnrichment(geneNames: string[]) {
  return useQuery({
    queryKey: ['enrichment', geneNames],
    queryFn: async () => {
      const response = await axios.post(
        'https://biit.cs.ut.ee/gprofiler/api/gost/profile/',
        {
          organism: 'hsapiens',
          query: geneNames,
          sources: GPROFILER_SOURCES,
          user_threshold: 0.05,
          significance_threshold_method: 'fdr',
          // Asks g:Profiler which query genes hit each term. Without it a term
          // knows only how many genes matched, not which — and the network
          // highlight needs the names.
          no_evidences: false,
        }
      )
      const results = response.data?.result ?? []
      const queryMeta = Object.values(
        response.data?.meta?.genes_metadata?.query ?? {}
      )[0] as { mapping?: Record<string, string[]>; ensgs?: string[] } | undefined

      // `intersections` runs parallel to `ensgs`; an empty entry means that gene
      // is not in the term. Gene symbols come back from the submitted mapping.
      const symbolByEnsg: Record<string, string> = {}
      for (const [symbol, ensgs] of Object.entries(queryMeta?.mapping ?? {})) {
        for (const ensg of ensgs) symbolByEnsg[ensg] = symbol
      }
      const geneOrder = (queryMeta?.ensgs ?? []).map((e) => symbolByEnsg[e] ?? e)

      return results.map((r: Record<string, unknown>) => ({
        name: r.name as string,
        source: r.source as EnrichmentSource,
        p_value: r.p_value as number,
        term_id: r.native as string,
        genes: ((r.intersections as unknown[][]) ?? [])
          .map((hit, i) => (hit?.length ? geneOrder[i] : null))
          .filter((g): g is string => Boolean(g)),
      })) as EnrichmentTerm[]
    },
    enabled: geneNames.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

// Legacy aliases kept for backward compatibility
export type GOTerm = EnrichmentTerm
export const useGOEnrichment = useEnrichment
