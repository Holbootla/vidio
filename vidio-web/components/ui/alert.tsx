import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Alert({
  className,
  variant = "destructive",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "destructive" | "default";
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        variant === "destructive" && "border-destructive/40 bg-destructive/10 text-destructive",
        variant === "default" && "border-border bg-muted text-foreground",
        className,
      )}
      {...props}
    />
  );
}
