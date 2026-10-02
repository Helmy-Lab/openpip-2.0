import { describe, it, expect } from 'vitest'
import { TISSUE_LABELS, tissueLabel, searchTissues } from './tissues'

describe('tissueLabel', () => {
  it('names the brain PCoA clusters instead of numbering them', () => {
    expect(tissueLabel('brain_0')).toBe('Brain basal ganglia')
    expect(tissueLabel('brain_1')).toBe('Brain cerebellum')
    expect(tissueLabel('brain_2')).toBe('Brain other')
  })

  it('never renders a bare cluster index', () => {
    for (const key of Object.keys(TISSUE_LABELS)) {
      expect(tissueLabel(key)).not.toMatch(/\d/)
    }
  })

  it('prettifies a tissue it has no label for', () => {
    expect(tissueLabel('bladder_wall')).toBe('Bladder Wall')
  })
})

describe('searchTissues', () => {
  it('suggests a tissue from a prefix', () => {
    expect(searchTissues('liv')).toContain('Liver')
  })

  it('ranks prefix matches before substring matches', () => {
    // "test" starts Testis but also appears inside nothing else; use a prefix
    // that does both to prove ordering.
    const results = searchTissues('col')
    expect(results[0].toLowerCase().startsWith('col')).toBe(true)
  })

  it('finds the brain clusters by their real names', () => {
    // The whole point of recovering these labels: "cerebellum" is findable,
    // "brain_1" was not.
    expect(searchTissues('cerebell')).toContain('Brain cerebellum')
  })

  it('stays quiet until there is enough to go on', () => {
    expect(searchTissues('l')).toEqual([])
    expect(searchTissues('')).toEqual([])
  })

  it('caps the list so the dropdown stays usable', () => {
    expect(searchTissues('e', 3).length).toBeLessThanOrEqual(3)
  })
})
