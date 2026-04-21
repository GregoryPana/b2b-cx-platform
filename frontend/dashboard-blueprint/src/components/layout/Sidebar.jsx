import { ArrowLeftRight, Building2, CalendarDays, ChartLine, ChartPie, FileChartLine, LayoutList, LogOut, Menu, MessageSquareWarning, ScanEye, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile, onLogout, onSwitchPlatform, userName, userEmail, activePlatform, pendingReviewCount }) {
  const normalizedPlatform = String(activePlatform || "").toLowerCase();
  const isB2BPlatform = normalizedPlatform.includes("b2b");
  const isMysteryShopperPlatform = normalizedPlatform.includes("mystery");
  const isInstallationPlatform = normalizedPlatform.includes("installation");
   const items = [
     { to: "/", label: "Analytics", icon: ChartPie },
     ...(isB2BPlatform ? [{ to: "/planned", label: "Planned Visits", icon: CalendarDays }] : []),
     ...(isB2BPlatform || isMysteryShopperPlatform || isInstallationPlatform ? [{ to: "/trends", label: "Trends", icon: ChartLine }] : []),
     ...(!isInstallationPlatform ? [{ to: "/review", label: "Review", icon: ScanEye }] : []),
     ...(isB2BPlatform ? [{ to: "/actions", label: "Action Points", icon: MessageSquareWarning }] : []),
      ...(isB2BPlatform || isMysteryShopperPlatform || isInstallationPlatform ? [{ to: "/surveys", label: "Surveys", icon: LayoutList }] : []),
      ...(isB2BPlatform || isInstallationPlatform ? [{ to: "/reports", label: "Reports", icon: FileChartLine }] : []),
      ...(isInstallationPlatform ? [{ to: "/contractors", label: "Contractors", icon: Building2 }] : []),
      ...(isB2BPlatform ? [{ to: "/businesses", label: "Businesses", icon: Building2 }] : []),
     ...(isB2BPlatform ? [{ to: "/executives", label: "Account Executives", icon: Building2 }] : []),
     ...(isMysteryShopperPlatform
       ? [
           { to: "/locations", label: "Locations", icon: Building2 },
           { to: "/purposes", label: "Purposes", icon: FileChartLine },
         ]
       : []),
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
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
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
        <nav className="custom-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
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
                    {item.to === "/review" && pendingReviewCount > 0 ? (
                      <span className={cn(
                        "ml-auto inline-flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white",
                        collapsed ? "h-4 w-4 -ml-1 -mt-3" : "h-5 min-w-[20px] px-1",
                      )}>
                        {pendingReviewCount > 99 ? "99+" : pendingReviewCount}
                      </span>
                    ) : null}
                  </Button>
                )}
              </NavLink>
            );
          })}
        </nav>
        {!collapsed ? (
          <div className="shrink-0 border-t bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
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
