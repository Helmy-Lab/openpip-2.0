import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import type { Protein } from '../../../types/api'
import { ncbiGeneUrl } from './ncbi'

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
        return (
          <a
            href={ncbiGeneUrl(row.original.protein_entrez_id, name)}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'underline', fontWeight: 500 }}
          >
            {name}
          </a>
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
            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
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
            color: isQuery ? 'var(--primary-deep)' : 'var(--text-muted)',
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
        <span style={{ display: 'block', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>
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
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '.07em',
  color: 'var(--text-muted)',
  userSelect: 'none',
  background: 'var(--surface-2)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

export function InteractorsTable({ proteins, queryProteinIds }: InteractorsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = buildColumns(queryProteinIds)

  const table = useReactTable({
    data: proteins,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div style={{ background: 'var(--bg)' }}>
      <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: 13, background: 'var(--bg)' }}>
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
                  <td key={cell.id} style={{ padding: '8px 16px', color: 'var(--text)' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
