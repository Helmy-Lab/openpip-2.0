import type { ElementDefinition } from 'cytoscape'
import type { Protein, Interaction } from '../../../types/api'

export interface NodeEdgePalette {
  queryNode: string
  interactorNode: string
  published: string   // order 1
  validated: string   // order 2
  verified: string    // order 3
  literature: string  // order 4
}

const DEFAULT_PALETTE: NodeEdgePalette = {
  queryNode: '#e11d48',
  interactorNode: '#2563eb',
  published: '#38761d',
  validated: '#1155cc',
  verified: '#cc0000',
  literature: '#ff9900',
}

// Keep the old type alias for callers that only need edge colors
export type EdgeColorPalette = Pick<NodeEdgePalette, 'published' | 'validated' | 'verified' | 'literature'>

const FALLBACK_COLOR = '#cccccc'

/** A protein's value for one tissue, or null when absent or unparsable. */
function tissueValue(values: Record<string, unknown> | undefined, tissue: string): number | null {
  const raw = values?.[tissue]
  if (raw === undefined || raw === null) return null
  const v = parseFloat(String(raw).trim())
  return Number.isFinite(v) ? v : null
}

/**
 * Legacy "Show tissue expression": node diameter is expression x 3 px, taking
 * the highest of the selected tissues. Null keeps the default size, as legacy
 * did for a missing or zero value.
 */
export function expressionNodeSize(protein: Protein, tissues: string[]): number | null {
  const values = tissues
    .map((t) => tissueValue(protein.tissue_expression_array, t))
    .filter((v): v is number => v !== null)
  const size = values.length ? Math.max(...values) * 3 : 0
  return size > 0 ? size : null
}

/** Legacy "Reflect tissue specificity" steps, low to high. */
export const SPECIFICITY_THRESHOLDS = [-10, -8, -5, -2, 2, 5, 8, 10]
export const SPECIFICITY_INTERACTOR_COLORS = [
  '#b1c9ef', '#8baee7', '#6494e0', '#3d79d8', '#3c78d8', '#2662c1', '#1e4e9a', '#173a73', '#0f274d',
]
export const SPECIFICITY_QUERY_COLORS = [
  '#ffd0d0', '#ffa2a2', '#ff7373', '#fe4545', '#cc0000', '#bb0000', '#b90000', '#8b0000', '#5c0000',
]

/**
 * Legacy getSpecificityColor. Legacy used strict < and > on both sides, so a
 * value exactly on a threshold got no color; here it falls into the step below.
 */
export function specificityColor(value: number, isQuery: boolean): string {
  const step = SPECIFICITY_THRESHOLDS.filter((t) => value > t).length
  return (isQuery ? SPECIFICITY_QUERY_COLORS : SPECIFICITY_INTERACTOR_COLORS)[step]
}

/** Which tissue-driven node styling is on, and for which tissues. */
export interface TissueDisplay {
  tissues: string[]
  size: boolean
  color: boolean
}

export function getEdgeColorByOrder(order: number, palette: NodeEdgePalette = DEFAULT_PALETTE): string {
  switch (order) {
    case 1: return palette.published
    case 2: return palette.validated
    case 3: return palette.verified
    case 4: return palette.literature
    default: return FALLBACK_COLOR
  }
}

export function buildElements(
  proteins: Protein[],
  interactions: Interaction[],
  queryProteinIds: number[],
  palette: NodeEdgePalette = DEFAULT_PALETTE,
  tissueDisplay: TissueDisplay = { tissues: [], size: false, color: false }
): ElementDefinition[] {
  const querySet = new Set(queryProteinIds)
  const { tissues } = tissueDisplay

  const nodes: ElementDefinition[] = proteins.map((protein) => {
    const isQuery = querySet.has(protein.protein_id)
    // Legacy colors by the first selected tissue with a value (one at a time).
    const specificity = tissueDisplay.color
      ? tissues.map((t) => tissueValue(protein.tissue_specificity_array, t)).find((v) => v !== null) ?? null
      : null
    const size = tissueDisplay.size ? expressionNodeSize(protein, tissues) : null
    return {
      data: {
        id: `p${protein.protein_id}`,
        label: protein.protein_gene_name,
        isQuery,
        // Bake node color into element data — same pattern as edge colors.
        // This guarantees the color updates when settings change without
        // relying on stylesheet hot-swap.
        nodeColor:
          specificity !== null
            ? specificityColor(specificity, isQuery)
            : isQuery
              ? palette.queryNode
              : palette.interactorNode,
        ...(size !== null && { size }),
      },
    }
  })

  const edges: ElementDefinition[] = interactions.map((interaction) => {
    const { highest_category_status, highest_order } = interaction.interaction_category_array
    return {
      data: {
        id: `i${interaction.interaction_id}`,
        source: `p${interaction.interactor_A.protein_id}`,
        target: `p${interaction.interactor_B.protein_id}`,
        color: getEdgeColorByOrder(highest_order, palette),
        score: interaction.score,
        category: highest_category_status,
      },
    }
  })

  return [...nodes, ...edges]
}
