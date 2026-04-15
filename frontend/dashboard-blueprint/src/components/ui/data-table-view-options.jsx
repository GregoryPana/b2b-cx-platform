export function DataTableViewOptions({ table }) {
  const columns = table.getAllLeafColumns().filter((column) => column.getCanHide());

  if (!columns.length) {
    return null;
  }

  return (
    <details className="relative">
      <summary className="flex h-10 cursor-pointer items-center rounded-md border border-input bg-background px-3 py-2 text-sm list-none">
        Columns
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border bg-background p-3 shadow-md">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Visible Columns</p>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={(event) => {
              event.preventDefault();
              columns.forEach((column) => column.toggleVisibility(true));
            }}
          >
            Reset
          </button>
        </div>
        <div className="space-y-2">
          {columns.map((column) => (
            <label key={column.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={column.getIsVisible()}
                onChange={(event) => column.toggleVisibility(event.target.checked)}
              />
              <span>{String(column.columnDef.headerTitle || column.columnDef.accessorKey || column.id)}</span>
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
