import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

// Lightweight column definition — no @tanstack/react-table dependency
export interface ColumnDef<TData> {
  id?: string;
  header: React.ReactNode | (() => React.ReactNode);
  accessorKey?: keyof TData;
  cell?: (props: { row: { original: TData; index: number } }) => React.ReactNode;
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  emptyMessage,
  page = 1,
  totalPages = 1,
  onPageChange,
  onRowClick,
}: DataTableProps<TData>) {
  const { t } = useTranslation();

  const renderHeader = (header: ColumnDef<TData>['header']): React.ReactNode => {
    if (typeof header === 'function') return header();
    return header;
  };

  const renderCell = (col: ColumnDef<TData>, row: TData, index: number): React.ReactNode => {
    if (col.cell) return col.cell({ row: { original: row, index } });
    if (col.accessorKey) return String((row as Record<string, unknown>)[col.accessorKey as string] ?? '');
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((col, i) => (
                <TableHead key={col.id ?? i}>{renderHeader(col.header)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length > 0 ? (
              data.map((row, i) => (
                <TableRow
                  key={i}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col, j) => (
                    <TableCell key={col.id ?? j}>{renderCell(col, row, i)}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-36 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{emptyMessage ?? t('common.actions.search')}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
