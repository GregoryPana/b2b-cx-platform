import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { DataTableColumnHeader } from "../ui/data-table-column-header";
import { DataTablePagination } from "../ui/data-table-pagination";
import { DataTableViewOptions } from "../ui/data-table-view-options";

export default function InstallationResponsesDataTable({ responses }) {
  const [sorting, setSorting] = useState([{ id: "question_number", desc: false }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filterColumn, setFilterColumn] = useState("question_text");

  const columns = useMemo(() => [
    { accessorKey: "question_number", headerTitle: "Question #", header: ({ column }) => <DataTableColumnHeader column={column} title="Question #" />, cell: ({ row }) => `Q${row.original.question_number}` },
    { accessorKey: "question_text", headerTitle: "Question", header: ({ column }) => <DataTableColumnHeader column={column} title="Question" />, cell: ({ row }) => row.original.question_text || "--" },
    { accessorKey: "score", headerTitle: "Score (1-5)", header: ({ column }) => <DataTableColumnHeader column={column} title="Score (1-5)" />, cell: ({ row }) => row.original.score },
  ], []);

  const table = useReactTable({
    data: responses,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 120, size: 220, maxSize: 700 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const activeFilterValue = table.getColumn(filterColumn)?.getFilterValue() ?? "";

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="flex flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <Select value={filterColumn} onChange={(event) => setFilterColumn(event.target.value)} className="md:w-[220px]">
              <option value="question_text">Filter by question</option>
              <option value="question_number">Filter by question #</option>
              <option value="score">Filter by score</option>
            </Select>
            <Input value={activeFilterValue} onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)} className="md:max-w-sm" />
          </div>
          <div className="flex gap-2">
            <DataTableViewOptions table={table} />
            <Select value={`${table.getState().pagination.pageSize}`} onChange={(event) => table.setPageSize(Number(event.target.value))} className="md:w-[120px]">
              {[7, 10, 20].map((size) => <option key={size} value={`${size}`}>{size} rows</option>)}
            </Select>
          </div>
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="relative" style={{ width: header.getSize() }}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}{header.column.getCanResize() ? <div onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none" /> : null}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="align-top whitespace-normal break-words" style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length}>No responses found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
