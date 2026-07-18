"use client";

import { Cloud, CloudOff, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { useSyncContext } from "@/features/sync/SyncProvider";
import { cn } from "@/lib/utils/cn";

const statusCopy = {
  idle: { label: "Synced", icon: Cloud },
  offline: { label: "Offline", icon: CloudOff },
  queued: { label: "Pending sync", icon: RefreshCw },
  syncing: { label: "Syncing", icon: Loader2 },
  error: { label: "Sync issue", icon: TriangleAlert },
} as const;

export function SyncStatusBadge() {
  const { status, queuedCount, lastError } = useSyncContext();
  const copy = statusCopy[status];
  const Icon = copy.icon;

  const description =
    status === "queued"
      ? `${queuedCount} change${queuedCount === 1 ? "" : "s"} waiting to sync`
      : status === "error"
        ? (lastError ?? "Sync failed")
        : copy.label;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium",
        status === "offline" && "bg-muted text-muted-foreground",
        status === "error" && "bg-destructive/15 text-destructive",
        status === "queued" && "bg-amber-500/20 text-amber-950 dark:text-amber-100",
        status === "syncing" && "bg-accent text-accent-foreground",
        status === "idle" && "bg-muted/60 text-muted-foreground",
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      title={description}
    >
      <Icon className={cn("h-3.5 w-3.5", status === "syncing" && "animate-spin")} aria-hidden />
      <span className="hidden sm:inline">{description}</span>
      <span className="sr-only">{description}</span>
    </div>
  );
}
