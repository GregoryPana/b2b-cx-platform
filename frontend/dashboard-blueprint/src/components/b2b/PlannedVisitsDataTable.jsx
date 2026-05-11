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
import { DataTableViewOptions } from "../ui/data-table-view-options";

export default function PlannedVisitsDataTable({
  data,
  editingVisitId,
  editForm,
  onEditFormChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  loading,
}) {
  const [sorting, setSorting] = useState([{ id: "visit_date", desc: false }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filterColumn, setFilterColumn] = useState("business_name");

  const tableMeta = useMemo(() => ({
    editingVisitId,
    editForm,
    onEditFormChange,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onDelete,
  }), [editForm, editingVisitId, onCancelEdit, onDelete, onEditFormChange, onSaveEdit, onStartEdit]);

  const columns = useMemo(() => [
    {
      accessorKey: "business_name",
      headerTitle: "Business",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Business" />,
      cell: ({ row }) => row.original.business_name || "--",
    },
    {
      accessorKey: "visit_date",
      headerTitle: "Date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row, table }) => {
        const visit = row.original;
        const visitKey = String(visit.id || visit.visit_id);
        const isEditing = visitKey === table.options.meta?.editingVisitId;
        const form = table.options.meta?.editForm;
        return isEditing ? (
          <Input type="date" value={form?.visit_date || ""} onChange={(event) => table.options.meta?.onEditFormChange({ ...form, visit_date: event.target.value })} />
        ) : (visit.visit_date || "--");
      },
    },
    {
      accessorKey: "visit_type",
      headerTitle: "Type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row, table }) => {
        const visit = row.original;
        const visitKey = String(visit.id || visit.visit_id);
        const isEditing = visitKey === table.options.meta?.editingVisitId;
        const form = table.options.meta?.editForm;
        return isEditing ? (
          <Select value={form?.visit_type || "Planned"} onChange={(event) => table.options.meta?.onEditFormChange({ ...form, visit_type: event.target.value })}>
            <option value="Planned">Planned</option>
            <option value="Priority">Priority</option>
            <option value="Substitution">Substitution</option>
          </Select>
        ) : (visit.visit_type || "--");
      },
    },
    {
      accessorKey: "status",
      headerTitle: "Status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.status || "Draft"}</Badge>,
    },
    {
      id: "progress",
      headerTitle: "Progress",
      header: "Progress",
      cell: ({ row }) => `${row.original.mandatory_answered_count || 0}/${row.original.mandatory_total_count || 0}`,
      enableSorting: false,
    },
    {
      id: "actions",
      headerTitle: "Actions",
      header: "Actions",
      cell: ({ row, table }) => {
        const visit = row.original;
        const visitKey = String(visit.id || visit.visit_id);
        const isEditing = visitKey === table.options.meta?.editingVisitId;
        return (
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <Button type="button" size="sm" onClick={() => table.options.meta?.onSaveEdit(visit.id || visit.visit_id)}>Save</Button>
                <Button type="button" size="sm" variant="outline" onClick={table.options.meta?.onCancelEdit}>Cancel</Button>
              </>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={() => table.options.meta?.onStartEdit(visit)}>Edit</Button>
            )}
            <Button type="button" size="sm" variant="destructive" onClick={() => table.options.meta?.onDelete(visit.id || visit.visit_id)}>Delete</Button>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    columnResizeMode: "onChange",
    meta: tableMeta,
    defaultColumn: { minSize: 120, size: 170, maxSize: 520 },
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
              <option value="visit_type">Filter by type</option>
              <option value="status">Filter by status</option>
            </Select>
            <Input type={filterColumn === "visit_date" ? "date" : "text"} value={activeFilterValue} onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)} className="md:max-w-sm" />
          </div>
          <div className="flex gap-2">
            <DataTableViewOptions table={table} />
            <Button type="button" variant="ghost" onClick={() => { setColumnFilters([]); setColumnVisibility({}); setSorting([{ id: "visit_date", desc: false }]); setFilterColumn("business_name"); }}>
              Reset Table
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
                    {header.column.getCanResize() ? <div onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none" /> : null}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length}>Loading draft planned visits...</TableCell></TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-top whitespace-normal break-words" style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length}>No draft planned visits found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
