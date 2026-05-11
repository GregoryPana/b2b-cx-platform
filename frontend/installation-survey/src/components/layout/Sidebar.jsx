import { BookOpen, ClipboardCheck, LogOut, Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export default function Sidebar({ collapsed, mobileOpen, onToggle, onCloseMobile, onLogout, userEmail }) {
  const items = [
    { to: "/", label: "Assessment", icon: ClipboardCheck },
    { to: "/user-guide", label: "User Guide", icon: BookOpen },
  ];

  return (
    <>
      {mobileOpen ? <button type="button" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onCloseMobile} aria-label="Close navigation" /> : null}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden border-r bg-card transition-all duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "w-72 lg:w-20" : "w-72",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          {!collapsed ? <span className="text-sm font-semibold">Installation Survey</span> : null}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onCloseMobile} aria-label="Close navigation">
              <X className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggle} aria-label="Toggle sidebar">
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <nav className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} onClick={() => onCloseMobile()}>
                {({ isActive }) => (
                  <Button variant={isActive ? "secondary" : "ghost"} className={cn("w-full justify-start gap-3", collapsed && "justify-center px-0")}>
                    <Icon className="h-4 w-4" />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </Button>
                )}
              </NavLink>
            );
          })}
        </nav>

        {!collapsed ? (
          <div className="shrink-0 border-t bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <p className="truncate text-xs text-muted-foreground">{userEmail || "No email"}</p>
            <Button variant="outline" className="mt-2 w-full justify-start" onClick={onLogout}>
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        ) : null}
      </aside>
    </>
  );
}
