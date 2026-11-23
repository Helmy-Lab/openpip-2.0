import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { Protein } from '../../../types/api'
import { GeneLink } from './GeneLink'
import { TableSearch } from './TableSearch'

interface InteractorsTableProps {
  proteins: Protein[]
  queryProteinIds: number[]
}

function SortIcon({ isSorted }: { isSorted: false | 'asc' | 'desc' }) {
  if (isSorted === 'asc') return <span style={{ marginLeft: 4 }}>↑</span>
  if (isSorted === 'desc') return <span style={{ marginLeft: 4 }}>↓</span>
  return <span style={{ marginLeft: 4, color: 'var(--border-strong)' }}>⇅</span>
}

function buildColumns(queryProteinIds: number[]): ColumnDef<Protein>[] {
  return [
    {
      accessorKey: 'protein_gene_name',
      header: 'Gene Name',
      cell: ({ row, getValue }) => {
        const name = getValue<string>()
        if (!name) return '—'
        const p = row.original
        return (
          <GeneLink
            ids={{ gene: name, uniprot: p.protein_uniprot_id, entrez: p.protein_entrez_id, ensembl: p.protein_ensembl_id }}
            style={{ fontWeight: 500 }}
          />
        )
      },
    },
    {
      accessorKey: 'protein_uniprot_id',
      header: 'UniProt ID',
      cell: ({ getValue }) => {
        const id = getValue<string>()
        return (
          <a
            href={`https://www.uniprot.org/uniprot/${id}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--table-link)', textDecoration: 'underline' }}
          >
            {id}
          </a>
        )
      },
    },
    {
      accessorKey: 'protein_ensembl_id',
      header: 'Ensembl ID',
    },
    {
      id: 'type',
      header: 'Type',
      accessorFn: (row) =>
        queryProteinIds.includes(row.protein_id) ? 'Query' : 'Interactor',
      cell: ({ getValue }) => {
        const val = getValue<string>()
        const isQuery = val === 'Query'
        return (
          <span style={{
            display: 'inline-block',
            borderRadius: 4,
            padding: '1px 7px',
            fontSize: 11,
            fontWeight: 600,
            border: '1px solid var(--border)',
            background: isQuery ? 'var(--primary-soft)' : 'var(--surface-2)',
            color: isQuery ? 'var(--table-link)' : 'var(--text-muted)',
          }}>
            {val}
          </span>
        )
      },
    },
    {
      accessorKey: 'number_of_interactions_in_database',
      header: '# Interactions',
      cell: ({ getValue }) => (
        <span style={{ display: 'block', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12 }}>
          {getValue<number>()}
        </span>
      ),
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

export function InteractorsTable({ proteins, queryProteinIds }: InteractorsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = buildColumns(queryProteinIds)

  const table = useReactTable({
    data: proteins,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
                No proteins to display.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--text)' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      </TableSearch>
    </div>
  )
}
