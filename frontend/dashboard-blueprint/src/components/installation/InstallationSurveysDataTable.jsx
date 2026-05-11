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
import { DataTableViewOptions } from "../ui/data-table-view-options";

export default function InstallationSurveysDataTable({ data, loading, onView }) {
  const [sorting, setSorting] = useState([{ id: "date_work_done", desc: true }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filterColumn, setFilterColumn] = useState("customer_name");

  const columns = useMemo(() => [
    { accessorKey: "customer_name", headerTitle: "Customer", header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />, cell: ({ row }) => row.original.customer_name || "--" },
    { accessorKey: "inspector_name", headerTitle: "Quality Assurance Inspector", header: ({ column }) => <DataTableColumnHeader column={column} title="Quality Assurance Inspector" />, cell: ({ row }) => row.original.inspector_name || "--" },
    { accessorKey: "work_order", headerTitle: "Work Order", header: ({ column }) => <DataTableColumnHeader column={column} title="Work Order" />, cell: ({ row }) => row.original.work_order || "--" },
    { accessorKey: "location", headerTitle: "Location", header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />, cell: ({ row }) => row.original.location || "--" },
    { accessorKey: "date_work_done", headerTitle: "Date Work Done", header: ({ column }) => <DataTableColumnHeader column={column} title="Date Work Done" />, cell: ({ row }) => row.original.date_work_done || "--" },
    { accessorKey: "customer_type", headerTitle: "Customer Type", header: ({ column }) => <DataTableColumnHeader column={column} title="Customer Type" />, cell: ({ row }) => row.original.customer_type || "--" },
    { accessorKey: "job_done_by", headerTitle: "Worker Type", header: ({ column }) => <DataTableColumnHeader column={column} title="Worker Type" />, cell: ({ row }) => row.original.job_done_by || "--" },
    { accessorKey: "contractor_name", headerTitle: "Contractor", header: ({ column }) => <DataTableColumnHeader column={column} title="Contractor" />, cell: ({ row }) => row.original.contractor_name || "--" },
    { accessorKey: "field_team_members", headerTitle: "Field Team Members", header: ({ column }) => <DataTableColumnHeader column={column} title="Field Team Members" />, cell: ({ row }) => Array.isArray(row.original.field_team_members) && row.original.field_team_members.length ? row.original.field_team_members.join(", ") : "--" },
    { accessorKey: "overall_score", headerTitle: "Average", header: ({ column }) => <DataTableColumnHeader column={column} title="Average" />, cell: ({ row }) => row.original.overall_score != null ? Number(row.original.overall_score).toFixed(2) : "--" },
    {
      id: "actions",
      headerTitle: "Action",
      header: "Action",
      cell: ({ row }) => <Button type="button" variant="outline" size="sm" onClick={() => onView(row.original.survey_id)}>View</Button>,
      enableSorting: false,
      enableHiding: false,
    },
  ], [onView]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
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
              <option value="customer_name">Filter by customer</option>
              <option value="inspector_name">Filter by quality assessor</option>
              <option value="work_order">Filter by work order</option>
              <option value="location">Filter by location</option>
              <option value="date_work_done">Filter by date</option>
              <option value="customer_type">Filter by customer type</option>
              <option value="job_done_by">Filter by worker type</option>
              <option value="contractor_name">Filter by contractor</option>
              <option value="field_team_members">Filter by team member</option>
            </Select>
            <Input
              type={filterColumn === "date_work_done" ? "date" : "text"}
              value={activeFilterValue}
              onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)}
              className="md:max-w-sm"
            />
          </div>
          <div className="flex gap-2">
            <DataTableViewOptions table={table} />
            <Button type="button" variant="ghost" onClick={() => { setColumnFilters([]); setColumnVisibility({}); setSorting([{ id: "date_work_done", desc: true }]); setFilterColumn("customer_name"); }}>
              Reset Table
            </Button>
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
            {loading ? (
              <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length}>Loading installation surveys...</TableCell></TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-top whitespace-normal break-words" style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length}>No installation surveys found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
