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

export default function InstallationResponsesDataTable({ responses }) {
  const [sorting, setSorting] = useState([{ id: "question_number", desc: false }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [filterColumn, setFilterColumn] = useState("question_text");

  const columns = useMemo(() => [
    { accessorKey: "question_number", header: ({ column }) => <DataTableColumnHeader column={column} title="Question #" />, cell: ({ row }) => `Q${row.original.question_number}` },
    { accessorKey: "question_text", header: ({ column }) => <DataTableColumnHeader column={column} title="Question" />, cell: ({ row }) => row.original.question_text || "--" },
    { accessorKey: "score", header: ({ column }) => <DataTableColumnHeader column={column} title="Score (1-5)" />, cell: ({ row }) => row.original.score },
  ], []);

  const table = useReactTable({
    data: responses,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
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
          <Select value={`${table.getState().pagination.pageSize}`} onChange={(event) => table.setPageSize(Number(event.target.value))} className="md:w-[120px]">
            {[7, 10, 20].map((size) => <option key={size} value={`${size}`}>{size} rows</option>)}
          </Select>
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={columns.length}>No responses found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
