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

export default function ExecutivesDataTable({ data, selectedExecutive, executiveForm, setExecutiveForm, onStartNew, onEdit, onSave, onCancel, onDelete }) {
  const [sorting, setSorting] = useState([{ id: "name", desc: false }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filterColumn, setFilterColumn] = useState("name");
  const disabledSorting = useMemo(() => [], []);
  const selectedExecutiveId = selectedExecutive?.id ?? null;

  const tableMeta = useMemo(() => ({
    selectedExecutiveId,
    executiveForm,
    setExecutiveForm,
    onEdit,
    onSave,
    onCancel,
    onDelete,
  }), [onCancel, onDelete, onEdit, onSave, selectedExecutiveId, executiveForm, setExecutiveForm]);

  const columns = useMemo(() => [
    {
      accessorKey: "name",
      headerTitle: "Name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row, table }) => {
        const executive = row.original;
        const isEditing = table.options.meta?.selectedExecutiveId === executive.id;
        const form = table.options.meta?.executiveForm;
        return isEditing ? <Input value={form?.name || ""} onChange={(e) => table.options.meta?.setExecutiveForm((prev) => ({ ...prev, name: e.target.value }))} /> : (executive.name || "--");
      },
    },
    {
      accessorKey: "email",
      headerTitle: "Email",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row, table }) => {
        const executive = row.original;
        const isEditing = table.options.meta?.selectedExecutiveId === executive.id;
        const form = table.options.meta?.executiveForm;
        return isEditing ? <Input value={form?.email || ""} onChange={(e) => table.options.meta?.setExecutiveForm((prev) => ({ ...prev, email: e.target.value }))} /> : (executive.email || "--");
      },
    },
    {
      id: "actions",
      headerTitle: "Actions",
      header: "Actions",
      cell: ({ row, table }) => {
        const executive = row.original;
        const isEditing = table.options.meta?.selectedExecutiveId === executive.id;
        return (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button type="button" size="sm" onClick={table.options.meta?.onSave}>Save</Button>
                <Button type="button" variant="outline" size="sm" onClick={table.options.meta?.onCancel}>Cancel</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => table.options.meta?.onEdit(executive)}>Edit</Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => table.options.meta?.onDelete(executive)}>Delete</Button>
              </>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], []);

  const tableData = useMemo(() => {
    if (selectedExecutive?.id === "new") {
      return [{ id: "new", name: executiveForm.name, email: executiveForm.email }, ...data];
    }
    return data;
  }, [data, executiveForm, selectedExecutive]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting: selectedExecutiveId ? disabledSorting : sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    columnResizeMode: "onChange",
    meta: tableMeta,
    getRowId: (row) => String(row.id),
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
            <Select value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)} className="md:w-[220px]">
              <option value="name">Filter by name</option>
              <option value="email">Filter by email</option>
            </Select>
            <Input value={activeFilterValue} onChange={(e) => table.getColumn(filterColumn)?.setFilterValue(e.target.value)} className="md:max-w-sm" />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onStartNew}>Add Account Executive</Button>
            <DataTableViewOptions table={table} />
            <Button type="button" variant="ghost" onClick={() => { setColumnFilters([]); setColumnVisibility({}); setSorting([{ id: "name", desc: false }]); setFilterColumn("name"); }}>Reset Table</Button>
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-top whitespace-normal break-words" style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length}>No account executives found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
