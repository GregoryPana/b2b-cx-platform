import { Menu, Moon, Sun } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export default function Header({ theme, toggleTheme, onOpenMobileNav }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
          <Menu className="h-4 w-4" />
        </Button>
        <h1 className="truncate text-lg font-semibold">Dashboard Overview</h1>
      </div>
      <div className="flex items-center gap-3">
        <Input className="hidden w-64 md:flex" placeholder="Search..." aria-label="Search" />
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
