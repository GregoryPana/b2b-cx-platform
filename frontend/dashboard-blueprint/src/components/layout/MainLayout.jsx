import { useState } from "react";
import { cn } from "../../lib/utils";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function MainLayout({ children, onLogout, onSwitchPlatform, userName, userEmail, activePlatform, pendingReviewCount }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState("light");

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <div className="relative flex min-h-screen bg-background">
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
        <Header theme={theme} toggleTheme={toggleTheme} onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="custom-scrollbar flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
