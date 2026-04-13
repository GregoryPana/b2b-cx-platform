import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { DataTableColumnHeader } from "../ui/data-table-column-header";
import { DataTablePagination } from "../ui/data-table-pagination";

export default function InstallationSurveysDataTable({ data, loading, onView }) {
  const [sorting, setSorting] = useState([{ id: "date_work_done", desc: true }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [filterColumn, setFilterColumn] = useState("customer_name");

  const columns = useMemo(() => [
    { accessorKey: "customer_name", header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />, cell: ({ row }) => row.original.customer_name || "--" },
    { accessorKey: "inspector_name", header: ({ column }) => <DataTableColumnHeader column={column} title="Inspector/Auditor" />, cell: ({ row }) => row.original.inspector_name || "--" },
    { accessorKey: "location", header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />, cell: ({ row }) => row.original.location || "--" },
    { accessorKey: "date_work_done", header: ({ column }) => <DataTableColumnHeader column={column} title="Date Work Done" />, cell: ({ row }) => row.original.date_work_done || "--" },
    { accessorKey: "customer_type", header: ({ column }) => <DataTableColumnHeader column={column} title="Customer Type" />, cell: ({ row }) => row.original.customer_type || "--" },
    { accessorKey: "job_done_by", header: ({ column }) => <DataTableColumnHeader column={column} title="Worker Type" />, cell: ({ row }) => row.original.job_done_by || "--" },
    { accessorKey: "overall_score", header: ({ column }) => <DataTableColumnHeader column={column} title="Average" />, cell: ({ row }) => row.original.overall_score != null ? Number(row.original.overall_score).toFixed(2) : "--" },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => <Button type="button" variant="outline" size="sm" onClick={() => onView(row.original.survey_id)}>View</Button>,
      enableSorting: false,
    },
  ], [onView]);

  const table = useReactTable({
    data,
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
              <option value="customer_name">Filter by customer</option>
              <option value="inspector_name">Filter by inspector</option>
              <option value="location">Filter by location</option>
              <option value="date_work_done">Filter by date</option>
              <option value="customer_type">Filter by customer type</option>
              <option value="job_done_by">Filter by worker type</option>
            </Select>
            <Input
              type={filterColumn === "date_work_done" ? "date" : "text"}
              value={activeFilterValue}
              onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)}
              className="md:max-w-sm"
            />
          </div>
          <Button type="button" variant="ghost" onClick={() => { setColumnFilters([]); setSorting([{ id: "date_work_done", desc: true }]); setFilterColumn("customer_name"); }}>
            Reset Table
          </Button>
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
            {loading ? (
              <TableRow><TableCell colSpan={columns.length}>Loading installation surveys...</TableCell></TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={columns.length}>No installation surveys found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
