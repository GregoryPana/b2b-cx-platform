import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { DataTableColumnHeader } from "../ui/data-table-column-header";
import { DataTablePagination } from "../ui/data-table-pagination";

export default function ReviewQueueDataTable({ data, onView, onApprove, onReject, loadingVisitId }) {
  const [sorting, setSorting] = useState([{ id: "visit_date", desc: true }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [filterColumn, setFilterColumn] = useState("business_name");

  const columns = useMemo(() => [
    {
      accessorKey: "business_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Business" />,
      cell: ({ row }) => row.original.business_name || "--",
    },
    {
      accessorKey: "visit_date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => row.original.visit_date || "--",
    },
    {
      accessorKey: "submitted_by_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Submitted By" />,
      cell: ({ row }) => row.original.submitted_by_name || row.original.submitted_by_email || "--",
    },
    {
      accessorKey: "account_executive_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Account Executive" />,
      cell: ({ row }) => row.original.account_executive_name || "--",
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <Badge variant="warning">{row.original.status || "Pending"}</Badge>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const visit = row.original;
        const visitId = String(visit.id || visit.visit_id || "");
        const isLoading = loadingVisitId === visitId;
        return (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onView(visitId)} disabled={isLoading}>View</Button>
            <Button type="button" size="sm" onClick={() => onApprove(visit)} disabled={isLoading}>Approve</Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => onReject(visit)} disabled={isLoading}>Reject</Button>
          </div>
        );
      },
      enableSorting: false,
    },
  ], [loadingVisitId, onApprove, onReject, onView]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 120, size: 180, maxSize: 520 },
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
              <option value="business_name">Filter by business</option>
              <option value="visit_date">Filter by date</option>
              <option value="submitted_by_name">Filter by submitter</option>
              <option value="account_executive_name">Filter by account executive</option>
              <option value="status">Filter by status</option>
            </Select>
            <Input
              type={filterColumn === "visit_date" ? "date" : "text"}
              placeholder="Filter selected column"
              value={activeFilterValue}
              onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)}
              className="md:max-w-sm"
            />
          </div>
          <Button type="button" variant="ghost" onClick={() => { setColumnFilters([]); setSorting([{ id: "visit_date", desc: true }]); setFilterColumn("business_name"); }}>
            Reset Table
          </Button>
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="relative" style={{ width: header.getSize() }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanResize() ? <div onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none" /> : null}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-top whitespace-normal break-words" style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>No pending visits in review queue.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
