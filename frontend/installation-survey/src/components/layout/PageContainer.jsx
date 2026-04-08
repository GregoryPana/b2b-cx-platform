import { cn } from "../../lib/utils";

export default function PageContainer({ className, children }) {
  return <div className={cn("mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8", className)}>{children}</div>;
}
