import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { Interaction, Protein } from '../../../types/api'
import { GeneLink } from './GeneLink'
import { TableSearch } from './TableSearch'
import { useSearchStore } from '../searchStore'

interface InteractionsTableProps {
  interactions: Interaction[]
  proteins: Protein[]
}

const CATEGORY_COLORS: Record<string, string> = {
  Published: 'var(--hi-union)',
  Validated: 'var(--huri-lit)',
  Verified: 'var(--danger)',
  Literature: 'var(--literature)',
  Mixed: 'var(--accent)',
}

function CategoryBadge({ status }: { status: string }) {
  const color = CATEGORY_COLORS[status] ?? 'var(--text-muted)'
  return (
    <span style={{
      display: 'inline-block',
      borderRadius: 4,
      padding: '1px 7px',
      fontSize: 11,
      fontWeight: 600,
      background: 'var(--surface-2)',
      color,
      border: '1px solid var(--border)',
    }}>
      {status}
    </span>
  )
}

function SortIcon({ isSorted }: { isSorted: false | 'asc' | 'desc' }) {
  if (isSorted === 'asc') return <span style={{ marginLeft: 4 }}>↑</span>
  if (isSorted === 'desc') return <span style={{ marginLeft: 4 }}>↓</span>
  return <span style={{ marginLeft: 4, color: 'var(--border-strong)' }}>⇅</span>
}

type Interactor = Interaction['interactor_A']

function InteractorLink({
  interactor,
  entrezById,
}: {
  interactor: Interactor
  entrezById: Map<number, string>
}) {
  const name = interactor.protein_gene_name
  if (!name) return <>—</>
  return (
    <GeneLink
      ids={{
        gene: name,
        uniprot: interactor.protein_uniprot_id,
        entrez: entrezById.get(interactor.protein_id),
        ensembl: interactor.protein_ensembl_id,
      }}
    />
  )
}

function buildColumns(entrezById: Map<number, string>): ColumnDef<Interaction>[] {
  return [
    {
      accessorFn: (row) => row.interactor_A.protein_gene_name,
      id: 'interactorA',
      header: 'Interactor A',
      cell: ({ row }) => (
        <InteractorLink interactor={row.original.interactor_A} entrezById={entrezById} />
      ),
    },
    {
      accessorFn: (row) => row.interactor_B.protein_gene_name,
      id: 'interactorB',
      header: 'Interactor B',
      cell: ({ row }) => (
        <InteractorLink interactor={row.original.interactor_B} entrezById={entrezById} />
      ),
    },
    {
      accessorKey: 'score',
      header: 'Score',
            cell: ({ getValue }) => {
        const val = getValue<number | null>()
        return (
          <span style={{ display: 'block', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12 }}>
            {val?.toFixed(2) ?? '—'}
          </span>
        )
      },
    },
    {
      accessorFn: (row) => row.interaction_category_array.highest_category_status,
      id: 'category',
      header: 'Category',
      cell: ({ getValue }) => <CategoryBadge status={getValue<string>()} />,
    },
    {
      accessorFn: (row) => row.dataset_array.map((d) => d.name).join(', '),
      id: 'datasets',
      header: 'Datasets',
    },
  ]
}

const TH_BASE: React.CSSProperties = {
  // Frozen while the results scroll under it.
  position: 'sticky',
  top: 0,
  zIndex: 1,
  padding: '8px 12px',
  textAlign: 'center',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  color: 'var(--text)',
  userSelect: 'none',
  background: 'var(--surface-2)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

export function InteractionsTable({ interactions, proteins }: InteractionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const entrezById = useMemo(
    () => new Map(proteins.map((p) => [p.protein_id, p.protein_entrez_id])),
    [proteins]
  )
  const columns = useMemo(() => buildColumns(entrezById), [entrezById])

  const table = useReactTable({
    data: interactions,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  // Every distinct text in the table, for the search box to suggest.
  const suggestions = [
    ...new Set(
      table
        .getCoreRowModel()
        .rows.flatMap((row) => row.getAllCells().map((cell) => cell.getValue()))
        .flatMap((v) => (typeof v === 'string' ? v.split(', ') : []))
        .filter(Boolean)
    ),
  ].sort()

  const { pageIndex, pageSize } = table.getState().pagination
  const totalRows = table.getFilteredRowModel().rows.length
  const highlight = useSearchStore((s) => s.highlight)
  const setHighlight = useSearchStore((s) => s.setHighlight)
  const pageCount = table.getPageCount()
  const currentPage = pageIndex + 1

  return (
    <div style={{ background: 'var(--bg)' }}>
      <TableSearch
        value={globalFilter}
        onChange={setGlobalFilter}
        suggestions={suggestions}
        fields={columns.map((c) => String(c.header))}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--bg)' }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ ...TH_BASE, cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                    onMouseEnter={(e) => { if (header.column.getCanSort()) e.currentTarget.style.background = 'var(--border)' }}
                    onMouseLeave={(e) => { if (header.column.getCanSort()) e.currentTarget.style.background = 'var(--surface-2)' }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <SortIcon isSorted={header.column.getIsSorted()} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody style={{ background: 'var(--bg)' }}>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}
                >
                  No interactions to display.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                // A row lights its two proteins and their edge in the network;
                // a second click lets go. Same store highlight as the
                // enrichment rows, so only one thing is ever lit.
                const term = `i${row.original.interaction_id}`
                const selected = highlight?.term === term
                return (
                <tr
                  key={row.id}
                  aria-pressed={selected}
                  onClick={() => {
                    // A drag to copy the row's text ends in a click; don't treat it as one.
                    if (!window.getSelection()?.isCollapsed) return
                    setHighlight(
                      selected
                        ? null
                        : { term, genes: [], interactionIds: [row.original.interaction_id] }
                    )
                  }}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selected ? 'var(--primary-soft)' : '',
                  }}
                  onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = '' }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text)' }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </TableSearch>

      {pageCount > 1 && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
          <span>
            {totalRows} interaction{totalRows !== 1 ? 's' : ''} · page {currentPage} of {pageCount} ({pageSize} per page)
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="op-btn"
              style={{ fontSize: 12, padding: '5px 12px' }}
            >
              Previous
            </button>
            <span style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: 12 }}>
              {currentPage} / {pageCount}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="op-btn"
              style={{ fontSize: 12, padding: '5px 12px' }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
