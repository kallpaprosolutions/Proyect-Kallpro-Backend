import { useState, ReactNode } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  /** Búsqueda global sobre todas las columnas */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Filas por página (default 10). 0 = sin paginación */
  pageSize?: number;
  /** Acción al hacer clic en una fila */
  onRowClick?: (row: T) => void;
  /** Estado de carga */
  loading?: boolean;
  /** Mensaje cuando no hay datos */
  emptyMessage?: string;
  emptyIcon?: string;
  /** Contenido extra a la derecha de la barra de búsqueda (filtros, botones) */
  toolbar?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Buscar...',
  pageSize = 10,
  onRowClick,
  loading = false,
  emptyMessage = 'No hay registros.',
  emptyIcon = '📭',
  toolbar,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize > 0 ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: pageSize > 0 ? { pagination: { pageSize } } : {},
  });

  const rows = table.getRowModel().rows;
  const totalRows = table.getFilteredRowModel().rows.length;

  return (
    <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-soft overflow-hidden">
      {/* Toolbar: búsqueda + extras */}
      {(searchable || toolbar) && (
        <div className="flex items-center gap-3 p-3 border-b border-surface-100 dark:border-surface-700 flex-wrap">
          {searchable && (
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">🔍</span>
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg pl-9 pr-4 py-2 text-sm text-surface-800 dark:text-white placeholder:text-surface-400 focus:outline-none focus:border-brand-500"
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-surface-50 dark:bg-surface-900/50">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={`text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide whitespace-nowrap ${canSort ? 'cursor-pointer select-none hover:text-surface-700 dark:hover:text-surface-300' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="text-surface-400">
                            {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '⇅'}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {loading ? (
              // Skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((_c, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-surface-100 dark:bg-surface-700 rounded animate-pulse" style={{ width: `${50 + ((i + j) % 4) * 12}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="text-3xl mb-2">{emptyIcon}</div>
                  <p className="text-surface-400 text-sm">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/10' : 'hover:bg-surface-50 dark:hover:bg-surface-700/30'}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-surface-800 dark:text-surface-100">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {pageSize > 0 && totalRows > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-surface-100 dark:border-surface-700 flex-wrap">
          <p className="text-xs text-surface-500">
            Mostrando {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            –{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, totalRows)} de {totalRows}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            <span className="text-xs text-surface-500 px-2">
              Pág. {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1.5 rounded-lg border border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
