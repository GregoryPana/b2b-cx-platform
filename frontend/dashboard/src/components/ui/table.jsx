import * as React from "react";

export const Table = React.forwardRef(({ className = "", ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={`w-full caption-bottom text-sm ${className}`.trim()} {...props} />
  </div>
));
Table.displayName = "Table";

export const TableHeader = React.forwardRef(({ className = "", ...props }, ref) => (
  <thead ref={ref} className={className} {...props} />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef(({ className = "", ...props }, ref) => (
  <tbody ref={ref} className={className} {...props} />
));
TableBody.displayName = "TableBody";

export const TableRow = React.forwardRef(({ className = "", ...props }, ref) => (
  <tr
    ref={ref}
    className={`border-b border-slate-200/70 transition-colors hover:bg-slate-100/50 ${className}`.trim()}
    {...props}
  />
));
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef(({ className = "", ...props }, ref) => (
  <th
    ref={ref}
    className={`h-11 px-4 text-left align-middle font-medium text-slate-700 ${className}`.trim()}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef(({ className = "", ...props }, ref) => (
  <td ref={ref} className={`p-4 align-top ${className}`.trim()} {...props} />
));
TableCell.displayName = "TableCell";
