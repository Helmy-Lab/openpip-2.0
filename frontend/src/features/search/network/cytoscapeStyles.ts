import type { StylesheetJsonBlock } from 'cytoscape'

// Node colors are read from data(nodeColor) — baked into element data at
// build time. This is the same reliable pattern used for edge colors and
// removes any dependency on stylesheet hot-swapping.
export function buildStylesheet(): StylesheetJsonBlock[] {
  return [
    {
      selector: 'node',
      style: {
        'background-color': 'data(nodeColor)',
        color: '#ffffff',
        label: 'data(label)',
        'text-outline-width': 1,
        'text-outline-color': '#333333',
        'font-size': 10,
        width: 36,
        height: 36,
        'text-valign': 'center',
        'text-halign': 'center',
      },
    },
    // data(size) is only set while "Show tissue expression" is on.
    {
      selector: 'node[size]',
      style: {
        width: 'data(size)',
        height: 'data(size)',
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 2,
        'border-color': '#ffff00',
      },
    },
    {
      selector: 'edge',
      style: {
        'line-color': 'data(color)',
        width: 2,
        opacity: 0.8,
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge:selected',
      style: {
        width: 4,
        opacity: 1.0,
      },
    },
  ]
}
