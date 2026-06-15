import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { DataTableColumnHeader } from "../../../components/ui/data-table-column-header";
import { DataTablePagination } from "../../../components/ui/data-table-pagination";
import { DataTableViewOptions } from "../../../components/ui/data-table-view-options";

function formatDDMMYYYY(dateStr) {
  if (!dateStr) return "--";
  const parts = String(dateStr).split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
}

function MandatoryProgress({ answered, total }) {
  if (!total) return <span className="text-muted-foreground">--</span>;
  const pct = Math.round((answered / total) * 100);
  const complete = answered >= total;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${complete ? "bg-emerald-500" : "bg-amber-400"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums ${complete ? "text-emerald-700" : "text-amber-700"}`}>
        {answered}/{total}
      </span>
    </div>
  );
}

const FILTER_OPTIONS = [
  { value: "location_name", label: "Filter by location" },
  { value: "shopper_name", label: "Filter by shopper" },
  { value: "purpose_of_visit", label: "Filter by purpose" },
  { value: "staff_on_duty", label: "Filter by staff" },
  { value: "visit_date", label: "Filter by date" },
];

export default function MysteryReviewQueueTable({ data, onView, onApprove, onReject, loadingVisitId }) {
  const [sorting, setSorting] = useState([{ id: "visit_date", desc: true }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filterColumn, setFilterColumn] = useState("location_name");

  const columns = useMemo(() => [
    {
      accessorKey: "location_name",
      headerTitle: "Location",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.location_name || row.original.business_name || "--"}
        </span>
      ),
    },
    {
      accessorKey: "visit_date",
      headerTitle: "Date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => formatDDMMYYYY(row.original.visit_date),
    },
    {
      accessorKey: "visit_time",
      headerTitle: "Time",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Time" />,
      cell: ({ row }) => row.original.visit_time || "--",
    },
    {
      accessorKey: "shopper_name",
      headerTitle: "Shopper",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Shopper" />,
      cell: ({ row }) => row.original.shopper_name || row.original.submitted_by_name || "--",
    },
    {
      accessorKey: "purpose_of_visit",
      headerTitle: "Purpose",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Purpose" />,
      cell: ({ row }) => row.original.purpose_of_visit || "--",
    },
    {
      accessorKey: "staff_on_duty",
      headerTitle: "Staff on Duty",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Staff on Duty" />,
      cell: ({ row }) => row.original.staff_on_duty || "--",
    },
    {
      id: "mandatory_progress",
      headerTitle: "Mandatory",
      header: "Mandatory",
      enableSorting: false,
      cell: ({ row }) => (
        <MandatoryProgress
          answered={row.original.mandatory_answered_count ?? 0}
          total={row.original.mandatory_total_count ?? 0}
        />
      ),
    },
    {
      accessorKey: "status",
      headerTitle: "Status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <Badge variant="warning">{row.original.status || "Pending"}</Badge>,
    },
    {
      id: "actions",
      headerTitle: "Actions",
      header: "Actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const visit = row.original;
        const visitId = String(visit.id || visit.visit_id || "");
        const isLoading = loadingVisitId === visitId;
        return (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onView(visitId)} disabled={isLoading}>
              View
            </Button>
            <Button type="button" size="sm" onClick={() => onApprove(visit)} disabled={isLoading}>
              Approve
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => onReject(visit)} disabled={isLoading}>
              Reject
            </Button>
          </div>
        );
      },
    },
  ], [loadingVisitId, onApprove, onReject, onView]);

  const tableData = useMemo(
    () => data.map((v) => ({ ...v, location_name: v.location_name || v.business_name || "" })),
    [data],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 100, size: 160, maxSize: 400 },
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
            <Select
              value={filterColumn}
              onChange={(e) => {
                setFilterColumn(e.target.value);
                setColumnFilters([]);
              }}
              className="md:w-[220px]"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
            <Input
              type={filterColumn === "visit_date" ? "date" : "text"}
              placeholder="Filter selected column"
              value={activeFilterValue}
              onChange={(e) => table.getColumn(filterColumn)?.setFilterValue(e.target.value)}
              className="md:max-w-sm"
            />
          </div>
          <div className="flex gap-2">
            <DataTableViewOptions table={table} />
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setColumnFilters([]);
                setColumnVisibility({});
                setSorting([{ id: "visit_date", desc: true }]);
                setFilterColumn("location_name");
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="relative" style={{ width: header.getSize() }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanResize() ? (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none"
                      />
                    ) : null}
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
                    <TableCell
                      key={cell.id}
                      className="align-top whitespace-normal break-words"
                      style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="py-8 text-center text-sm text-muted-foreground">
                  No visits are waiting for review.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
