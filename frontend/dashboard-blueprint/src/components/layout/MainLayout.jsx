import { useLayoutEffect, useState } from "react";
import { cn } from "../../lib/utils";
import Header from "./Header";
import Sidebar from "./Sidebar";

const THEME_STORAGE_KEY = "cx.dashboardTheme";

export default function MainLayout({ children, onLogout, onSwitchPlatform, userName, userEmail, activePlatform, pendingReviewCount }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) || "light";
    } catch {
      return "light";
    }
  });

  // Apply the theme class in an effect (not during render). Layout effect so the first paint is already the right theme.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <div className="relative flex min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={onLogout}
        onSwitchPlatform={onSwitchPlatform}
        userName={userName}
        userEmail={userEmail}
        activePlatform={activePlatform}
        pendingReviewCount={pendingReviewCount}
      />
      <div className={cn("flex min-w-0 flex-1 flex-col transition-all duration-300", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        <Header theme={theme} toggleTheme={toggleTheme} onOpenMobileNav={() => setMobileOpen(true)} activePlatform={activePlatform} />
        <main id="main-content" tabIndex={-1} className="custom-scrollbar flex-1 overflow-y-auto focus:outline-none">{children}</main>
      </div>
    </div>
  );
}
