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

export default function BusinessesDataTable({
  data,
  representatives,
  representativeMap,
  selectedBusiness,
  businessForm,
  setBusinessForm,
  accountExecutiveQuery,
  setAccountExecutiveQuery,
  onStartNew,
  onEdit,
  onSave,
  onCancel,
  onRetire,
  onDelete,
}) {
  const businessTypeLabel = (value) => {
    const normalized = String(value || "").toLowerCase();
    return normalized === "large_corporate" || normalized === "high" ? "Large Business/Corporate" : "SME";
  };
  const [sorting, setSorting] = useState([{ id: "name", desc: false }]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [filterColumn, setFilterColumn] = useState("name");

  const columns = useMemo(() => [
    {
      accessorKey: "name",
      headerTitle: "Name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const business = row.original;
        const isEditing = selectedBusiness?.id === business.id;
        return isEditing ? <Input value={businessForm.name} onChange={(e) => setBusinessForm((prev) => ({ ...prev, name: e.target.value }))} /> : business.name;
      },
    },
    {
      accessorKey: "location",
      headerTitle: "Location",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
      cell: ({ row }) => {
        const business = row.original;
        const isEditing = selectedBusiness?.id === business.id;
        return isEditing ? <Input value={businessForm.location} onChange={(e) => setBusinessForm((prev) => ({ ...prev, location: e.target.value }))} /> : (business.location || "--");
      },
    },
    {
      accessorKey: "priority_level",
      headerTitle: "Business Type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Business Type" />,
      cell: ({ row }) => {
        const business = row.original;
        const isEditing = selectedBusiness?.id === business.id;
        return isEditing ? (
          <Select value={businessForm.priority_level} onChange={(e) => setBusinessForm((prev) => ({ ...prev, priority_level: e.target.value }))}>
            <option value="large_corporate">Large Business/Corporate</option>
            <option value="sme">SME</option>
          </Select>
        ) : (
          <Badge variant={businessTypeLabel(business.priority_level) === "Large Business/Corporate" ? "default" : "secondary"}>
            {businessTypeLabel(business.priority_level)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "account_executive_id",
      headerTitle: "Account Executive",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Account Executive" />,
      cell: ({ row }) => {
        const business = row.original;
        const isEditing = selectedBusiness?.id === business.id;
        return isEditing ? (
          <>
            <Input
              list={`account-executives-${business.id}`}
              value={accountExecutiveQuery}
              onChange={(e) => {
                const value = e.target.value;
                setAccountExecutiveQuery(value);
                const match = representatives.find((exec) => {
                  const label = exec.name || exec.full_name || exec.display_name || exec.email || "";
                  return label.toLowerCase() === value.toLowerCase();
                });
                setBusinessForm((prev) => ({ ...prev, account_executive_id: match ? String(match.id) : "" }));
              }}
            />
            <datalist id={`account-executives-${business.id}`}>
              {representatives.map((exec) => (
                <option key={exec.id} value={exec.name || exec.full_name || exec.display_name || exec.email || "Unknown"} />
              ))}
            </datalist>
          </>
        ) : (representativeMap[business.account_executive_id] || "Unassigned");
      },
      sortingFn: (rowA, rowB) => String(representativeMap[rowA.original.account_executive_id] || "").localeCompare(String(representativeMap[rowB.original.account_executive_id] || "")),
      filterFn: (row, _id, value) => String(representativeMap[row.original.account_executive_id] || "").toLowerCase().includes(String(value || "").toLowerCase()),
    },
    {
      accessorKey: "active",
      headerTitle: "Status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const business = row.original;
        const isEditing = selectedBusiness?.id === business.id;
        return isEditing ? (
          <Select value={businessForm.active ? "active" : "inactive"} onChange={(e) => setBusinessForm((prev) => ({ ...prev, active: e.target.value === "active" }))}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        ) : (
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${business.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
            {business.active ? "Active" : "Retired"}
          </span>
        );
      },
      sortingFn: (rowA, rowB) => Number(Boolean(rowA.original.active)) - Number(Boolean(rowB.original.active)),
      filterFn: (row, _id, value) => String(row.original.active ? "active" : "inactive").includes(String(value || "").toLowerCase()),
    },
    {
      id: "actions",
      headerTitle: "Actions",
      header: "Actions",
      cell: ({ row }) => {
        const business = row.original;
        const isEditing = selectedBusiness?.id === business.id;
        return (
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button type="button" size="sm" onClick={onSave}>Save</Button>
                <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => onEdit(business)}>Edit</Button>
                {business.active ? <Button type="button" variant="outline" size="sm" onClick={() => onRetire(business)}>Retire</Button> : null}
                <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(business)}>Delete</Button>
              </>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ], [accountExecutiveQuery, businessForm, onCancel, onDelete, onEdit, onRetire, onSave, representativeMap, representatives, selectedBusiness, setAccountExecutiveQuery, setBusinessForm]);

  const tableData = useMemo(() => {
    if (selectedBusiness?.id === "new") {
      return [
        { id: "new", name: businessForm.name, location: businessForm.location, priority_level: businessForm.priority_level, account_executive_id: businessForm.account_executive_id, active: businessForm.active },
        ...data,
      ];
    }
    return data;
  }, [data, selectedBusiness, businessForm]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting: selectedBusiness?.id ? [] : sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    columnResizeMode: "onChange",
    getRowId: (row) => String(row.id),
    defaultColumn: { minSize: 120, size: 180, maxSize: 540 },
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
              <option value="location">Filter by location</option>
              <option value="priority_level">Filter by business type</option>
              <option value="account_executive_id">Filter by account executive</option>
              <option value="active">Filter by status</option>
            </Select>
            <Input value={activeFilterValue} onChange={(e) => table.getColumn(filterColumn)?.setFilterValue(e.target.value)} className="md:max-w-sm" />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onStartNew}>Add Business</Button>
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
                <TableRow key={row.id} className={!row.original.location || !row.original.account_executive_id ? "bg-warning/10" : ""}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="align-top whitespace-normal break-words" style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={table.getVisibleLeafColumns().length}>No businesses found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
