import { describe, it, expect } from 'vitest'
import { parseUniprotEntry } from './useUniprotEntry'

describe('parseUniprotEntry', () => {
  it('pulls out organism, size, function and biological keywords', () => {
    expect(
      parseUniprotEntry({
        organism: { scientificName: 'Homo sapiens', commonName: 'Human' },
        sequence: { length: 393, molWeight: 43653 },
        comments: [{ commentType: 'FUNCTION', texts: [{ value: 'Tumour suppressor.' }] }],
        keywords: [
          { name: '3D-structure', category: 'Technical term' },
          { name: 'Apoptosis', category: 'Biological process' },
        ],
      })
    ).toEqual({
      organism: 'Homo sapiens (Human)',
      length: 393,
      mass: 43653,
      function: 'Tumour suppressor.',
      keywords: ['Apoptosis'],
    })
  })

  it('leaves out what the entry does not have', () => {
    expect(parseUniprotEntry({})).toEqual({
      organism: null,
      length: null,
      mass: null,
      function: null,
      keywords: [],
    })
  })
})
