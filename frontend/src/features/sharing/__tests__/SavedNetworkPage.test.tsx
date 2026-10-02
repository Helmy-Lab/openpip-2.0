import { describe, it, expect } from 'vitest'
import { snapshotViewState } from '../snapshotViewState'

const withCategories = (...names: string[]) =>
  names.map((name) => ({ interaction_category_array: { highest_category_status: name } }))

describe('snapshotViewState', () => {
  it('restores the score, categories and tissues the network was saved with', () => {
    const view = snapshotViewState({
      score_parameter: '0.40',
      category_array: 'Published',
      tissue_expression_array: 'liver,lung',
      all_interactions: withCategories('Published', 'Literature', ''),
    })
    expect(view).toEqual({
      filterMode: 'None',
      scoreFilter: 0.4,
      categoryFilter: { Published: true, Literature: false },
      tissueFilter: ['liver', 'lung'],
    })
  })

  it('leaves categories alone for networks saved before they were recorded', () => {
    const view = snapshotViewState({
      score_parameter: '0.00',
      category_array: '',
      tissue_expression_array: '',
      all_interactions: withCategories('Published'),
    })
    expect(view.categoryFilter).toBeUndefined()
    expect(view.tissueFilter).toEqual([])
  })
})
