import { useQuery } from '@tanstack/react-query'
import { baseAccession } from './uniprot'

/** The parts of a UniProt entry the summary tab shows. */
export interface UniprotEntry {
  organism: string | null
  length: number | null
  /** Daltons. */
  mass: number | null
  function: string | null
  keywords: string[]
}

interface UniprotJson {
  organism?: { scientificName?: string; commonName?: string }
  sequence?: { length?: number; molWeight?: number }
  comments?: { commentType: string; texts?: { value: string }[] }[]
  keywords?: { name: string; category: string }[]
}

export function parseUniprotEntry(json: UniprotJson): UniprotEntry {
  const { scientificName, commonName } = json.organism ?? {}
  return {
    organism: scientificName
      ? commonName ? `${scientificName} (${commonName})` : scientificName
      : null,
    length: json.sequence?.length ?? null,
    mass: json.sequence?.molWeight ?? null,
    function:
      json.comments
        ?.filter((c) => c.commentType === 'FUNCTION')
        .flatMap((c) => c.texts ?? [])
        .map((x) => x.value)
        .join(' ') || null,
    // "Technical term" keywords (3D-structure, Reference proteome) say nothing
    // about the protein's biology.
    keywords: (json.keywords ?? [])
      .filter((k) => k.category !== 'Technical term')
      .map((k) => k.name),
  }
}

async function fetchUniprotEntry(uniprotId: string): Promise<UniprotEntry> {
  const res = await fetch(
    `https://rest.uniprot.org/uniprotkb/${baseAccession(uniprotId)}.json` +
      '?fields=organism_name,length,mass,cc_function,keyword'
  )
  if (!res.ok) throw new Error(`UniProt lookup failed: ${res.status}`)
  return parseUniprotEntry(await res.json())
}

export function useUniprotEntry(uniprotId: string) {
  return useQuery<UniprotEntry>({
    queryKey: ['uniprot-entry', uniprotId],
    queryFn: () => fetchUniprotEntry(uniprotId),
    staleTime: 86_400_000,
    retry: 1,
    enabled: !!uniprotId,
  })
}
