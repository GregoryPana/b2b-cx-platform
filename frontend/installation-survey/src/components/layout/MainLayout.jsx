import { useState } from "react";
import { cn } from "../../lib/utils";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function MainLayout({ children, onLogout, userName, userEmail, statusText }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed(!collapsed)}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={onLogout}
        userEmail={userEmail}
      />
      <div className={cn("flex flex-1 flex-col transition-all duration-300", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        <Header userName={userName} statusText={statusText} onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto custom-scrollbar">{children}</main>
      </div>
    </div>
  );
}
