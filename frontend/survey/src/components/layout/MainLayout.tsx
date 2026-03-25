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

  return (
    <div className="relative flex min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} onLogout={onLogout} userEmail={userEmail} />
      <div className={cn("flex flex-1 flex-col transition-all duration-300", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        <Header userName={userName} statusText={statusText} />
        <main className="flex-1 overflow-y-auto custom-scrollbar">{children}</main>
      </div>
    </div>
  );
}
