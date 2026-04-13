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
      cell: ({ row }) => {
        const visit = row.original;
        const visitKey = String(visit.id || visit.visit_id);
        return visitKey === editingVisitId ? (
          <Input type="date" value={editForm.visit_date} onChange={(event) => onEditFormChange({ ...editForm, visit_date: event.target.value })} />
        ) : (visit.visit_date || "--");
      },
    },
    {
      accessorKey: "visit_type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => {
        const visit = row.original;
        const visitKey = String(visit.id || visit.visit_id);
        return visitKey === editingVisitId ? (
          <Select value={editForm.visit_type} onChange={(event) => onEditFormChange({ ...editForm, visit_type: event.target.value })}>
            <option value="Planned">Planned</option>
            <option value="Priority">Priority</option>
            <option value="Substitution">Substitution</option>
          </Select>
        ) : (visit.visit_type || "--");
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <Badge variant="secondary">{row.original.status || "Draft"}</Badge>,
    },
    {
      id: "progress",
      header: "Progress",
      cell: ({ row }) => `${row.original.mandatory_answered_count || 0}/${row.original.mandatory_total_count || 0}`,
      enableSorting: false,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const visit = row.original;
        const visitKey = String(visit.id || visit.visit_id);
        const isEditing = visitKey === editingVisitId;
        return (
          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <Button type="button" size="sm" onClick={() => onSaveEdit(visit.id || visit.visit_id)}>Save</Button>
                <Button type="button" size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
              </>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={() => onStartEdit(visit)}>Edit</Button>
            )}
            <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(visit.id || visit.visit_id)}>Delete</Button>
          </div>
        );
      },
      enableSorting: false,
    },
  ], [editForm, editingVisitId, onCancelEdit, onDelete, onEditFormChange, onSaveEdit, onStartEdit]);

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
              <option value="visit_type">Filter by type</option>
              <option value="status">Filter by status</option>
            </Select>
            <Input type={filterColumn === "visit_date" ? "date" : "text"} value={activeFilterValue} onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)} className="md:max-w-sm" />
          </div>
          <Button type="button" variant="ghost" onClick={() => { setColumnFilters([]); setSorting([{ id: "visit_date", desc: false }]); setFilterColumn("business_name"); }}>
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
              <TableRow><TableCell colSpan={columns.length}>Loading draft planned visits...</TableCell></TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={columns.length}>No draft planned visits found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
