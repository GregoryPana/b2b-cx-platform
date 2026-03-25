import { motion } from "framer-motion";

interface HeaderProps {
  userName: string;
  statusText: string;
}

export default function Header({ userName, statusText }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <motion.div
        className="flex h-14 items-center justify-between px-4 md:px-6"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div>
          <p className="text-sm font-semibold">B2B Survey Workspace</p>
          <p className="text-xs text-muted-foreground">{statusText}</p>
        </div>
        <p className="text-xs text-muted-foreground">{userName || "Unknown user"}</p>
      </motion.div>
    </header>
  );
}
