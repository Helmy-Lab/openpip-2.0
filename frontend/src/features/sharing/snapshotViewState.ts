import type { ViewState } from '../search/searchStore'

/**
 * The filters the network was saved with. The stored interactions already
 * reflect them, including the filter mode (which legacy's table has no column
 * for), so the mode is reset to show every stored interaction.
 */
export function snapshotViewState(network: {
  score_parameter: string
  category_array: string
  tissue_expression_array: string
  all_interactions: { interaction_category_array: { highest_category_status: string } }[]
}): Partial<ViewState> {
  const view: Partial<ViewState> = { filterMode: 'None' }
  const score = Number.parseFloat(network.score_parameter)
  if (Number.isFinite(score)) view.scoreFilter = score
  const saved = network.category_array.split(',').filter(Boolean)
  if (saved.length) {
    const present = new Set(
      network.all_interactions.map((i) => i.interaction_category_array.highest_category_status)
    )
    view.categoryFilter = Object.fromEntries(
      [...present].filter(Boolean).map((name) => [name, saved.includes(name)])
    )
  }
  view.tissueFilter = network.tissue_expression_array.split(',').filter(Boolean)
  return view
}
