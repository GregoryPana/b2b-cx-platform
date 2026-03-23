import React, { createContext, useContext } from "react";
import { cn } from "../../lib/utils";

const TabsContext = createContext({ value: "", onValueChange: () => {} });

function Tabs({ value, onValueChange, className, children }) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, children, ...props }) {
  return (
    <div className={cn("tabs-list inline-flex items-center gap-1 rounded-md p-1", className)} {...props}>
      {children}
    </div>
  );
}

function TabsTrigger({ value, className, children, ...props }) {
  const context = useContext(TabsContext);
  const isActive = context.value === value;
  return (
    <button
      type="button"
      onClick={() => context.onValueChange(value)}
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "tabs-trigger inline-flex h-8 items-center justify-center rounded-sm px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        isActive ? "active" : "",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { Tabs, TabsList, TabsTrigger };
