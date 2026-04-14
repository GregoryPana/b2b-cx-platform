import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { DataTableColumnHeader } from "../ui/data-table-column-header";
import { DataTablePagination } from "../ui/data-table-pagination";

export default function SimpleStatusDataTable({ data, entityLabel, onActivate, onDeactivate, onDelete }) {
  const [sorting, setSorting] = useState([{ id: "name", desc: false }]);
  const [columnFilters, setColumnFilters] = useState([]);

  const columns = useMemo(() => [
    { accessorKey: "name", header: ({ column }) => <DataTableColumnHeader column={column} title={entityLabel} />, cell: ({ row }) => row.original.name },
    { accessorKey: "active", header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />, cell: ({ row }) => <Badge variant={row.original.active ? "success" : "secondary"}>{row.original.active ? "Active" : "Inactive"}</Badge> },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-2">
          {row.original.active ? (
            <Button type="button" variant="outline" size="sm" onClick={() => onDeactivate(row.original.id)}>Deactivate</Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => onActivate(row.original.id)}>Reactivate</Button>
          )}
          <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(row.original)}>Delete</Button>
        </div>
      ),
      enableSorting: false,
    },
  ], [entityLabel, onActivate, onDeactivate, onDelete]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 120, size: 180, maxSize: 420 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="border-b p-3">
          <Input value={table.getColumn("name")?.getFilterValue() ?? ""} onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)} placeholder={`Filter ${entityLabel.toLowerCase()}`} className="md:max-w-sm" />
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => <TableHead key={header.id} className="relative" style={{ width: header.getSize() }}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}{header.column.getCanResize() ? <div onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none" /> : null}</TableHead>)}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="align-top whitespace-normal break-words" style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
              </TableRow>
            )) : <TableRow><TableCell colSpan={columns.length}>No {entityLabel.toLowerCase()} found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
