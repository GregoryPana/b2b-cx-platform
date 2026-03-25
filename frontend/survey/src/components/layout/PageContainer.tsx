import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn("mx-auto w-full max-w-[1600px] p-4 md:p-6", className)}>{children}</div>;
}
