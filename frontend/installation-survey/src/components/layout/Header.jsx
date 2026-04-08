import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { Button } from "../ui/button";

export default function Header({ userName, statusText, onOpenMobileNav }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <motion.div
        className="flex h-14 items-center justify-between px-4 md:px-6"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Installation Survey</p>
            <p className="truncate text-xs text-muted-foreground">{statusText}</p>
          </div>
        </div>
        <p className="truncate pl-2 text-xs text-muted-foreground">{userName || "Unknown user"}</p>
      </motion.div>
    </header>
  );
}
