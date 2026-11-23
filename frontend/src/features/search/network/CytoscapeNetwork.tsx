import { useRef, useState, useMemo, useEffect } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import cytoscape from 'cytoscape'
import type { LayoutOptions } from 'cytoscape'
import cola from 'cytoscape-cola'
import type { Protein, Interaction } from '../../../types/api'
import { buildElements, getEdgeColorByOrder, specificityRamp } from './cytoscapeElements'
import { tissueLabel } from '../../../lib/tissues'
import { buildStylesheet } from './cytoscapeStyles'
import { useCanvasBackground, useCanvasStyleStore, type CanvasStyle } from './canvasBackground'
import { useSettings } from '../../../api/settings'
import { useSearchStore } from '../searchStore'
import { SettingsDropdown } from '../toolbar/SettingsDropdown'
import { FilterDropdown } from '../toolbar/FilterDropdown'
import { ConfidenceDropdown } from '../toolbar/ConfidenceDropdown'
import { useText } from '../../../text'
import cytoscapeLogo from '../../../assets/cytoscape.svg'
import { CONTROL_BG, CONTROL_HEIGHT } from '../toolbar/LayoutDropdown'

// Register cytoscape-cola extension once at module level.
// Wrapped in try/catch to silently ignore double-registration errors
// (can happen during hot reload).
try {
  cytoscape.use(cola)
} catch {
  // already registered — safe to ignore
}

export type LayoutName = 'cola' | 'cose' | 'concentric' | 'circle' | 'grid'

interface CytoscapeNetworkProps {
  proteins: Protein[]
  interactions: Interaction[]
  queryProteinIds: number[]
  layout: LayoutName
  height?: number
  /**
   * The homepage example: a picture, not a workspace. No legend or controls,
   * and none of the search page's canvas state (background, tissue sizing,
   * enrichment highlight) reaches it.
   */
  preview?: boolean
  /** Filter and Confidence buttons; off under the ribbon, which carries them. */
  showFilters?: boolean
  onNodeClick?: (protein: Protein) => void
  onEdgeClick?: (interaction: Interaction) => void
}

interface TooltipState {
  x: number
  y: number
  label: string
}

// Stylesheet is static — node colors live in data(nodeColor), edge colors in data(color).
// Both are baked into element data by buildElements() so they update automatically
// when the palette changes, with no stylesheet hot-swap needed.
const STYLESHEET = buildStylesheet()
const NO_TISSUES: string[] = []
const NO_STYLE: CanvasStyle = {}

export function CytoscapeNetwork({
  proteins,
  interactions,
  queryProteinIds,
  layout,
  height = 500,
  preview = false,
  showFilters = true,
  onNodeClick,
  onEdgeClick,
}: CytoscapeNetworkProps) {
  // cy instance stored in a ref — not state — to avoid triggering re-renders.
  // Using `any` here because cytoscape-cola augments the cytoscape types in ways
  // that make strict typing impractical; see frontend/CLAUDE.md.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cyRef = useRef<any>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const { data: settings } = useSettings()
  const setModal = useSearchStore((s) => s.setModal)
  const storeHighlight = useSearchStore((s) => s.highlight)
  const storeTissues = useSearchStore((s) => s.tissueFilter)
  const storeTissueNodeSize = useSearchStore((s) => s.tissueNodeSize)
  const storeTissueNodeColor = useSearchStore((s) => s.tissueNodeColor)
  const canvasBackground = useCanvasBackground()
  const storeStyle = useCanvasStyleStore((s) => s.style)
  const userStyle = preview ? NO_STYLE : storeStyle
  const highlight = preview ? null : storeHighlight
  const tissues = preview ? NO_TISSUES : storeTissues
  const tissueNodeSize = preview ? false : storeTissueNodeSize
  const tissueNodeColor = preview ? false : storeTissueNodeColor
  const background = (preview ? null : canvasBackground) ?? 'var(--bg)'
  const t = useText()

  // The viewer's colours win over the admin's, which win over the built-ins.
  const palette = useMemo(() => ({
    queryNode:    userStyle.queryNode      ?? settings?.queryNodeColor      ?? '#e11d48',
    interactorNode: userStyle.interactorNode ?? settings?.interactorNodeColor ?? '#2563eb',
    published:    userStyle.published      ?? settings?.publishedEdgeColor  ?? '#38761d',
    validated:    userStyle.validated      ?? settings?.validatedEdgeColor  ?? '#1155cc',
    verified:     userStyle.verified       ?? settings?.verifiedEdgeColor   ?? '#cc0000',
    literature:   userStyle.literature     ?? settings?.literatureEdgeColor ?? '#0ea5e9',
  }), [
    userStyle,
    settings?.queryNodeColor,
    settings?.interactorNodeColor,
    settings?.publishedEdgeColor,
    settings?.validatedEdgeColor,
    settings?.verifiedEdgeColor,
    settings?.literatureEdgeColor,
  ])

  const elements = useMemo(
    () =>
      buildElements(proteins, interactions, queryProteinIds, palette, {
        tissues,
        size: tissueNodeSize,
        color: tissueNodeColor,
      }),
    [proteins, interactions, queryProteinIds, palette, tissues, tissueNodeSize, tissueNodeColor]
  )

  // Re-run layout whenever elements or layout name change.
  // elements change on every new search; layout changes when the user picks a different algorithm.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || elements.length === 0) return
    cy.layout({ name: layout } as LayoutOptions).run()
  }, [elements, layout])

  // Bind tap and hover event handlers. Re-bind whenever proteins/interactions
  // or the click callbacks change so the closures stay fresh.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    // Edge ids are "i<interaction_id>", node ids "p<protein_id>".
    const edgeIds = (edges: cytoscape.EdgeCollection) =>
      edges.map((edge) => parseInt(edge.id().slice(1), 10))

    // A tap lights what it touched: a node and its neighbours, or an edge and
    // its two ends. The homepage preview is a picture and lights nothing.
    const onNodeTap = (e: cytoscape.EventObject) => {
      const id = e.target.data('id') as string
      const proteinId = parseInt(id.slice(1), 10)
      const protein = proteins.find((p) => p.protein_id === proteinId)
      if (protein) onNodeClick?.(protein)
      if (!preview) {
        useSearchStore.getState().setHighlight({
          term: id,
          genes: [],
          interactionIds: edgeIds(e.target.connectedEdges()),
        })
      }
    }

    const onEdgeTap = (e: cytoscape.EventObject) => {
      const id = e.target.data('id') as string
      const intId = parseInt(id.slice(1), 10)
      const interaction = interactions.find((i) => i.interaction_id === intId)
      if (interaction) onEdgeClick?.(interaction)
      if (!preview) {
        useSearchStore.getState().setHighlight({ term: id, genes: [], interactionIds: [intId] })
      }
    }

    // A tap on empty canvas lets everything back up.
    const onBackgroundTap = (e: cytoscape.EventObject) => {
      if (e.target === cy && !preview) useSearchStore.getState().setHighlight(null)
    }

    const onNodeMouseover = (e: cytoscape.EventObject) => {
      const label = e.target.data('label') as string
      const { clientX, clientY } = e.originalEvent as MouseEvent
      setTooltip({ x: clientX, y: clientY, label })
      if (!preview) setHoverId(e.target.data('id') as string)
    }

    const onNodeMouseout = () => {
      setTooltip(null)
      setHoverId(null)
    }

    cy.on('tap', 'node', onNodeTap)
    cy.on('tap', 'edge', onEdgeTap)
    cy.on('tap', onBackgroundTap)
    cy.on('mouseover', 'node', onNodeMouseover)
    cy.on('mouseout', 'node', onNodeMouseout)

    return () => {
      cy.removeAllListeners()
    }
  }, [proteins, interactions, onNodeClick, onEdgeClick, preview])

  // Selecting an enrichment term dims the network and lights that term's
  // proteins plus the edges between them — legacy's setEnrichmentRowClickEvent.
  // Genes with no node (filtered out of the current graph) are skipped rather
  // than dereferenced, which is what legacy did before it threw.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    // Hovering a node lights it and its neighbours for as long as the mouse
    // stays; leaving falls back to whatever is selected.
    const hovered = hoverId ? cy.getElementById(hoverId) : null
    if (hovered?.nonempty()) {
      cy.elements().style({ opacity: 0.2 })
      hovered.closedNeighborhood().style({ opacity: 1 })
      return
    }
    if (!highlight) {
      cy.elements().style({ opacity: 1 })
      return
    }
    const genes = new Set(highlight.genes)
    let lit = cy.nodes().filter((n: { data: (k: string) => string }) => genes.has(n.data('label')))
    let litEdges = lit.edgesWith(lit)
    if (highlight.interactionIds) {
      const ids = new Set(highlight.interactionIds.map((id) => `i${id}`))
      litEdges = cy.edges().filter((edge: { id: () => string }) => ids.has(edge.id()))
      lit = lit.union(litEdges.connectedNodes())
    }
    cy.elements().style({ opacity: 0.2 })
    lit.style({ opacity: 1 })
    litEdges.style({ opacity: 1 })
  }, [highlight, hoverId, elements])

  // Build edge legend from actual category names in the current data so labels
  // match whatever the dataset calls them (e.g. "HI-Union" instead of "Verified").
  const edgeLegendItems = useMemo(() => {
    const seen = new Map<string, { color: string; order: number }>()
    interactions.forEach(({ interaction_category_array: { highest_category_status, highest_order } }) => {
      if (!seen.has(highest_category_status)) {
        seen.set(highest_category_status, {
          color: getEdgeColorByOrder(highest_order, palette),
          order: highest_order,
        })
      }
    })
    return Array.from(seen.entries())
      .sort((a, b) => a[1].order - b[1].order)
      .map(([label, { color }]) => ({ label, color, shape: 'line' as const }))
  }, [interactions, palette])

  const legendItems = [
    { label: 'Query node',  color: palette.queryNode,      shape: 'circle' as const },
    { label: 'Interactor',  color: palette.interactorNode, shape: 'circle' as const },
    ...edgeLegendItems,
  ]

  // Include palette values in the key so any color change forces a fresh
  // Cytoscape mount. react-cytoscapejs patches kept-element data on prop
  // changes, but Cytoscape doesn't always re-evaluate canvas styles for
  // data() references when data is mutated via .json() — remounting is
  // the only reliable path.
  const graphKey = [...Object.values(palette), ...tissues, tissueNodeSize, tissueNodeColor].join('-')

  return (
    <div style={{ position: 'relative', height, background }}>
      <CytoscapeComponent
        key={graphKey}
        elements={elements}
        stylesheet={STYLESHEET}
        layout={{ name: layout } as Parameters<typeof CytoscapeComponent>[0]['layout']}
        style={{ width: '100%', height, background }}
        cy={(cy) => {
          if (cyRef.current === cy) return
          cyRef.current = cy
          if (!preview) useSearchStore.getState().setNetworkCy(cy)
        }}
      />

      {/* Floating legend */}
      {!preview && (
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        background: CONTROL_BG,
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
        pointerEvents: 'none',
      }}>
        {legendItems.map(({ label, color, shape }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {shape === 'circle' ? (
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }} />
            ) : (
              <span style={{
                width: 16,
                height: 3,
                borderRadius: 2,
                background: color,
                flexShrink: 0,
              }} />
            )}
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {label}
            </span>
          </div>
        ))}
        {tissues.length > 0 && tissueNodeSize && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Node size: expression in {tissues.map(tissueLabel).join(', ')}
          </span>
        )}
        {tissues.length > 0 && tissueNodeColor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 16,
              height: 10,
              borderRadius: 2,
              background: `linear-gradient(to right, ${specificityRamp(palette.interactorNode)[0]}, ${specificityRamp(palette.interactorNode)[8]})`,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Tissue specificity in {tissues.map(tissueLabel).join(', ')} (low → high)
            </span>
          </div>
        )}
      </div>
      )}

      {/* Network controls, bottom right — out of the legend's way and away
          from the info panels, which anchor top left. Off on the homepage
          preview, which is a picture rather than a workspace. */}
      {!preview && (
      <div style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        zIndex: 10,
        display: 'flex',
        gap: 6,
      }}>
        {showFilters && <FilterDropdown />}

        {showFilters && <ConfidenceDropdown />}

        <SettingsDropdown />

        {/* Hand the network to a desktop Cytoscape over CyREST. Icon-only
            beside the layout button, matched to its height; the name is on
            hover. */}
        <button
          type="button"
          className="op-btn"
          title={t('search.download.cytoscape')}
          aria-label={t('search.download.cytoscape')}
          onClick={() => setModal('cyRest')}
          style={{
            height: CONTROL_HEIGHT,
            padding: '0 6px',
            lineHeight: 0,
            background: CONTROL_BG,
          }}
        >
          <img src={cytoscapeLogo} alt="" width={22} height={22} />
        </button>
      </div>
      )}

      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 10,
            top: tooltip.y - 30,
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '2px 6px',
            borderRadius: 3,
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  )
}
