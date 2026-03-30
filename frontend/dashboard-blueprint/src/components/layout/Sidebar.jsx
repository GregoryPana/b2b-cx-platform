import { ArrowLeftRight, BarChart3, Building2, CalendarDays, ClipboardCheck, FileBarChart2, LogOut, Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile, onLogout, onSwitchPlatform, userName, userEmail, activePlatform }) {
  const normalizedPlatform = String(activePlatform || "").toLowerCase();
  const isB2BPlatform = normalizedPlatform.includes("b2b");
  const isMysteryShopperPlatform = normalizedPlatform.includes("mystery");
  const items = [
    { to: "/", label: "Analytics", icon: BarChart3 },
    ...(isB2BPlatform ? [{ to: "/planned", label: "Planned Visits", icon: CalendarDays }] : []),
    { to: "/trends", label: "Trends", icon: FileBarChart2 },
    { to: "/review", label: "Review", icon: ClipboardCheck },
    ...(isB2BPlatform ? [{ to: "/actions", label: "Actions", icon: ClipboardCheck }] : []),
    { to: "/surveys", label: "Surveys", icon: FileBarChart2 },
    ...(isB2BPlatform ? [{ to: "/reports", label: "Reports", icon: FileBarChart2 }] : []),
    ...(isB2BPlatform ? [{ to: "/businesses", label: "Businesses", icon: Building2 }] : []),
    ...(isMysteryShopperPlatform
      ? [
          { to: "/locations", label: "Locations", icon: Building2 },
          { to: "/purposes", label: "Purposes", icon: FileBarChart2 },
        ]
      : []),
  ];

  return (
    <>
      {mobileOpen ? <button type="button" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onCloseMobile} aria-label="Close navigation" /> : null}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "w-72 lg:w-20" : "w-72",
        )}
      >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed ? <span className="text-lg font-semibold">CX Dashboard</span> : null}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onCloseMobile} aria-label="Close navigation">
            <X className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggle} aria-label="Toggle sidebar">
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} onClick={() => onCloseMobile()}>
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
          <p className="truncate text-xs text-muted-foreground">Platform: {activePlatform || "Not selected"}</p>
          <p className="truncate text-sm font-medium">{userName || "Unknown user"}</p>
          <p className="truncate text-xs text-muted-foreground">{userEmail || "No email"}</p>
          <Button variant="outline" className="mt-2 w-full justify-start" onClick={onSwitchPlatform}>
            <ArrowLeftRight className="h-4 w-4" /> Switch Platform
          </Button>
          <Button variant="outline" className="mt-2 w-full justify-start" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      ) : null}
      </aside>
    </>
  );
}
