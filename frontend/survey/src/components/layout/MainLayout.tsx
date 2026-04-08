import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface MainLayoutProps {
  children: ReactNode;
  onLogout: () => void;
  userName: string;
  userEmail: string;
  statusText: string;
}

export default function MainLayout({ children, onLogout, userName, userEmail, statusText }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isInstallationSurvey = String(import.meta.env.VITE_SURVEY_TYPE || "B2B") === "Installation Assessment";

  return (
    <div className="relative flex min-h-screen bg-background">
      {!isInstallationSurvey ? (
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggle={() => setCollapsed((prev) => !prev)}
          onCloseMobile={() => setMobileOpen(false)}
          onLogout={onLogout}
          userEmail={userEmail}
        />
      ) : null}
      <div className={cn("flex flex-1 flex-col transition-all duration-300", !isInstallationSurvey && (collapsed ? "lg:pl-20" : "lg:pl-72"))}>
        <Header
          userName={userName}
          statusText={statusText}
          onOpenMobileNav={() => setMobileOpen(true)}
          showMenuButton={!isInstallationSurvey}
        />
        <main className="flex-1 overflow-y-auto custom-scrollbar">{children}</main>
      </div>
    </div>
  );
}
