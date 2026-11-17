import { ArrowLeftRight, BookOpen, Building2, CalendarDays, ChartLine, ChartPie, ClipboardList, FileChartLine, HardHat, LayoutList, LogOut, MapPin, Menu, MessageSquareWarning, ScanEye, UserRound, Users, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

const BRAND_ASSET_BASE = `${import.meta.env.BASE_URL || "/"}branding/`;
const PLATFORM_ICON_MAP = {
  B2B: `${BRAND_ASSET_BASE}platforms/b2b.png`,
  "Mystery Shopper": `${BRAND_ASSET_BASE}platforms/mystery-shopper.png`,
  "Installation Assessment": `${BRAND_ASSET_BASE}platforms/installation-assessment.png`,
};

export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile, onLogout, onSwitchPlatform, userName, userEmail, activePlatform, pendingReviewCount }) {
  const normalizedPlatform = String(activePlatform || "").toLowerCase();
  const isB2BPlatform = normalizedPlatform.includes("b2b");
  const isMysteryShopperPlatform = normalizedPlatform.includes("mystery");
  const isInstallationPlatform = normalizedPlatform.includes("installation");
  const anyPlatform = isB2BPlatform || isMysteryShopperPlatform || isInstallationPlatform;
  // Grouped so the menu reads as three jobs (look, do, set up) instead of one flat list.
  const groups = [
    {
      label: "Insights",
      items: [
        { to: "/", label: "Analytics", icon: ChartPie },
        ...(anyPlatform ? [{ to: "/trends", label: "Trends", icon: ChartLine }] : []),
        ...(anyPlatform ? [{ to: "/surveys", label: "Surveys", icon: LayoutList }] : []),
        ...(anyPlatform ? [{ to: "/reports", label: "Reports", icon: FileChartLine }] : []),
      ],
    },
    {
      label: "Work",
      items: [
        ...(isB2BPlatform ? [{ to: "/planned", label: "Planned Visits", icon: CalendarDays }] : []),
        ...(!isInstallationPlatform ? [{ to: "/review", label: "Review", icon: ScanEye }] : []),
        ...(isB2BPlatform ? [{ to: "/actions", label: "Action Points", icon: MessageSquareWarning }] : []),
      ],
    },
    {
      label: "Manage",
      items: [
        ...(isInstallationPlatform ? [{ to: "/contractors", label: "Contractors", icon: HardHat }] : []),
        ...(isB2BPlatform ? [{ to: "/businesses", label: "Businesses", icon: Building2 }] : []),
        ...(isB2BPlatform ? [{ to: "/executives", label: "Account Executives", icon: UserRound }] : []),
        ...(isMysteryShopperPlatform
          ? [
              { to: "/locations", label: "Locations", icon: MapPin },
              { to: "/purposes", label: "Purposes", icon: ClipboardList },
              { to: "/mystery-users", label: "Users", icon: Users },
            ]
          : []),
        ...(anyPlatform ? [{ to: "/user-guide", label: "User Guide", icon: BookOpen }] : []),
      ],
    },
  ].filter((group) => group.items.length > 0);
  const activePlatformIcon = PLATFORM_ICON_MAP[activePlatform] || null;

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
          {!collapsed ? (
            <span className="flex items-center gap-2 text-lg font-semibold">
              {activePlatformIcon ? <img src={activePlatformIcon} alt={`${activePlatform || "Platform"} icon`} className="h-6 w-6 object-contain" /> : null}
              <span>CX Dashboard</span>
            </span>
          ) : (activePlatformIcon ? <img src={activePlatformIcon} alt={`${activePlatform || "Platform"} icon`} className="h-6 w-6 object-contain" /> : null)}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onCloseMobile} aria-label="Close navigation">
              <X className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggle} aria-label="Toggle sidebar">
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <nav className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3" aria-label="Main navigation">
          {groups.map((group, groupIndex) => (
            <div key={group.label} className={cn(groupIndex > 0 && "mt-4")}>
              {!collapsed ? (
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.label}</p>
              ) : groupIndex > 0 ? (
                <div className="mx-3 mb-2 border-t" aria-hidden="true" />
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => onCloseMobile()}>
                      {({ isActive }) => (
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          className={cn("w-full justify-start", collapsed && "justify-center px-0")}
                          title={collapsed ? item.label : undefined}
                          aria-label={collapsed ? item.label : undefined}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {!collapsed ? <span>{item.label}</span> : null}
                          {item.to === "/review" && pendingReviewCount > 0 ? (
                            <span className={cn(
                              "ml-auto inline-flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-destructive-foreground",
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
              </div>
            </div>
          ))}
        </nav>
        {!collapsed ? (
          <div className="shrink-0 space-y-3 border-t bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{userName || "Unknown user"}</p>
              <p className="truncate text-xs text-muted-foreground">{userEmail || "No email"}</p>
              <p className="truncate text-xs text-muted-foreground">{activePlatform || "No platform selected"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="justify-start" onClick={onSwitchPlatform}>
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" /> Switch
              </Button>
              <Button variant="outline" size="sm" className="justify-start" onClick={onLogout}>
                <LogOut className="h-4 w-4" aria-hidden="true" /> Logout
              </Button>
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
