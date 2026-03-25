import { ClipboardCheck, CalendarDays, LogOut, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  userEmail: string;
}

const items = [
  { to: "/planned", label: "Planned Visits", icon: CalendarDays },
  { to: "/survey", label: "Survey", icon: ClipboardCheck },
];

export default function Sidebar({ collapsed, onToggle, onLogout, userEmail }: SidebarProps) {
  return (
    <aside className={cn("fixed left-0 top-0 z-30 h-screen border-r bg-card transition-all duration-300", collapsed ? "w-20" : "w-72")}>
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!collapsed ? <span className="text-sm font-semibold">B2B Survey</span> : null}
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label="Toggle sidebar">
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      <nav className="space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to}>
              {({ isActive }) => (
                <Button variant={isActive ? "secondary" : "ghost"} className={cn("w-full justify-start", collapsed && "justify-center px-0")}>
                  <Icon className="h-4 w-4" />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Button>
              )}
            </NavLink>
          );
        })}
      </nav>

      {!collapsed ? (
        <div className="absolute bottom-0 left-0 right-0 border-t p-3">
          <p className="truncate text-xs text-muted-foreground">{userEmail || "No email"}</p>
          <Button variant="outline" className="mt-2 w-full justify-start" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
