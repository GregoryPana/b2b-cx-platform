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

export default function SurveysDataTable({ data, loading, isMysteryShopperPlatform, onViewDetails }) {
  const [sorting, setSorting] = useState([{ id: "visit_date", desc: true }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [filterColumn, setFilterColumn] = useState("account_executive_name");

  const columns = useMemo(() => [
    {
      accessorKey: "business_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title={isMysteryShopperPlatform ? "Location" : "Business"} />,
      cell: ({ row }) => row.original.business_name || "--",
    },
    {
      accessorKey: "visit_date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => row.original.visit_date || "--",
    },
    {
      accessorKey: "account_executive_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Account Executive" />,
      cell: ({ row }) => row.original.account_executive_name || "--",
    },
    {
      accessorKey: "team_member_names",
      header: "Team Members",
      cell: ({ row }) => (row.original.team_member_names || []).join(", ") || "--",
      enableSorting: false,
      filterFn: (row, id, value) => String((row.original.team_member_names || []).join(", ")).toLowerCase().includes(String(value || "").toLowerCase()),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "Approved"
              ? "success"
              : row.original.status === "Pending" || row.original.status === "Needs Changes"
              ? "warning"
              : row.original.status === "Rejected"
              ? "destructive"
              : "secondary"
          }
        >
          {row.original.status || "--"}
        </Badge>
      ),
    },
    {
      id: "progress",
      header: "Progress",
      cell: ({ row }) => `${row.original.mandatory_answered_count || 0}/${row.original.mandatory_total_count || 0}`,
      enableSorting: false,
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <Button type="button" variant="outline" size="sm" onClick={() => onViewDetails(row.original.id)}>
          View Details
        </Button>
      ),
      enableSorting: false,
    },
  ], [isMysteryShopperPlatform, onViewDetails]);

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
              <option value="business_name">Filter by business</option>
              <option value="visit_date">Filter by date</option>
              <option value="account_executive_name">Filter by account executive</option>
              <option value="team_member_names">Filter by team members</option>
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setColumnFilters([]);
              setSorting([{ id: "visit_date", desc: true }]);
              setFilterColumn("account_executive_name");
            }}
          >
            Reset Table
          </Button>
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length}>Loading survey results...</TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>No survey results found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination table={table} />
    </div>
  );
}
