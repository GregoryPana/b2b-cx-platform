import { useCallback, useEffect, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Select } from "../ui/select";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { DataTableColumnHeader } from "../ui/data-table-column-header";
import { DataTablePagination } from "../ui/data-table-pagination";
import { DataTableViewOptions } from "../ui/data-table-view-options";

function draftKey(item) {
  return `${item.response_id}-${item.action_index}`;
}

export default function ActionPointsDataTable({ data, statusOptions, onSaveActionPoint }) {
  const [sorting, setSorting] = useState([{ id: "visit_date", desc: true }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filterColumn, setFilterColumn] = useState("action_required");
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    const next = {};
    data.forEach((item) => {
      const key = draftKey(item);
      next[key] = { action_status: item.action_status || "Outstanding", action_comments: item.action_comments || "" };
    });
    setDrafts(next);
  }, [data]);

  const updateDraft = useCallback((item, changes) => {
    const key = draftKey(item);
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        ...changes,
      },
    }));
  }, []);

  const columns = useMemo(() => [
    { accessorKey: "visit_id", headerTitle: "Visit", header: ({ column }) => <DataTableColumnHeader column={column} title="Visit" />, cell: ({ row }) => row.original.visit_id },
    { accessorKey: "visit_date", headerTitle: "Date", header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />, cell: ({ row }) => row.original.visit_date || "--" },
    { accessorKey: "question_text", headerTitle: "Question", header: ({ column }) => <DataTableColumnHeader column={column} title="Question" />, cell: ({ row }) => row.original.question_text || "--" },
    { accessorKey: "action_required", headerTitle: "Action Required", size: 320, minSize: 220, maxSize: 720, header: ({ column }) => <DataTableColumnHeader column={column} title="Action Required" />, cell: ({ row }) => row.original.action_required || "--" },
    { accessorKey: "action_owner", headerTitle: "Lead Owner", header: ({ column }) => <DataTableColumnHeader column={column} title="Lead Owner" />, cell: ({ row }) => row.original.action_owner || "--" },
    { accessorKey: "action_timeframe", headerTitle: "Timeline", header: ({ column }) => <DataTableColumnHeader column={column} title="Timeline" />, cell: ({ row }) => row.original.action_timeframe || "--" },
    {
      accessorKey: "action_status",
      headerTitle: "Status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row, table }) => (
        <Select value={(table.options.meta?.drafts[draftKey(row.original)] || {}).action_status || row.original.action_status || "Outstanding"} onChange={(event) => table.options.meta?.updateDraft(row.original, { action_status: event.target.value })}>
          {table.options.meta?.statusOptions.map((option) => <option key={`${row.original.visit_id}-${row.original.question_id}-${option}`} value={option}>{option}</option>)}
        </Select>
      ),
    },
    { accessorKey: "action_support_needed", headerTitle: "Support Needed", header: ({ column }) => <DataTableColumnHeader column={column} title="Support Needed" />, cell: ({ row }) => row.original.action_support_needed || "--" },
    {
      accessorKey: "action_comments",
      headerTitle: "Comments",
      size: 320,
      minSize: 220,
      maxSize: 720,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Comments" />,
      cell: ({ row, table }) => (
        <Textarea
          className="min-h-24 resize-y"
          value={(table.options.meta?.drafts[draftKey(row.original)] || {}).action_comments ?? row.original.action_comments ?? ""}
          onChange={(event) => table.options.meta?.updateDraft(row.original, { action_comments: event.target.value })}
        />
      ),
    },
    { id: "save", headerTitle: "Save", header: "", cell: ({ row, table }) => <Button type="button" size="sm" variant="outline" onClick={() => table.options.meta?.onSaveActionPoint(row.original, table.options.meta?.drafts[draftKey(row.original)] || {})}>Save</Button>, enableSorting: false, enableHiding: false },
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    columnResizeMode: "onChange",
    meta: { drafts, onSaveActionPoint, statusOptions, updateDraft },
    defaultColumn: { minSize: 120, size: 180, maxSize: 560 },
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
              <option value="visit_id">Filter by visit</option>
              <option value="visit_date">Filter by date</option>
              <option value="question_text">Filter by question</option>
              <option value="action_required">Filter by action</option>
              <option value="action_owner">Filter by owner</option>
              <option value="action_status">Filter by status</option>
              <option value="action_comments">Filter by comments</option>
            </Select>
            <Input value={activeFilterValue} onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)} className="md:max-w-sm" />
          </div>
          <div className="flex gap-2">
            <DataTableViewOptions table={table} />
            <Button type="button" variant="ghost" onClick={() => { setColumnFilters([]); setColumnVisibility({}); setSorting([{ id: "visit_date", desc: true }]); setFilterColumn("action_required"); }}>
              Reset Table
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => <TableHead key={header.id} className="relative" style={{ width: header.getSize() }}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}{header.column.getCanResize() ? <div onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none" /> : null}</TableHead>)}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="align-top whitespace-normal break-words" style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
              </TableRow>
            )) : <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length}>No action points found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
