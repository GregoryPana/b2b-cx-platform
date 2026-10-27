import { Menu, Moon, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { getRouteContext } from "../../features/mystery-shopper/mysteryPresentation";

export default function Header({ theme, toggleTheme, onOpenMobileNav, activePlatform }) {
  const location = useLocation();
  const context = getRouteContext(location.pathname, activePlatform);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
          <Menu className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{context.title}</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{context.help}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
