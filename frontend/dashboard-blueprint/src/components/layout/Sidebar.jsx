import { BarChart3, Building2, ClipboardCheck, FileBarChart2, LogOut, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

const items = [
  { to: "/", label: "Analytics", icon: BarChart3 },
  { to: "/trends", label: "Trends", icon: FileBarChart2 },
  { to: "/review", label: "Review", icon: ClipboardCheck },
  { to: "/businesses", label: "Businesses", icon: Building2 },
];

export default function Sidebar({ collapsed, onToggle, onLogout, userName, userEmail }) {
  return (
    <aside className={cn("fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300", collapsed ? "w-20" : "w-72")}>
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed ? <span className="text-lg font-semibold">CX Dashboard</span> : null}
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
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn("w-full justify-start", collapsed && "justify-center px-0")}
                >
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
          <p className="truncate text-sm font-medium">{userName || "Unknown user"}</p>
          <p className="truncate text-xs text-muted-foreground">{userEmail || "No email"}</p>
          <Button variant="outline" className="mt-2 w-full justify-start" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
