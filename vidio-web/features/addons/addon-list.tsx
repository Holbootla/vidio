"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AddonDto } from "@/lib/api/schemas";
import { cn } from "@/lib/utils/cn";

interface AddonListProps {
  addons: AddonDto[];
  pendingInstallationId: string | null;
  removingInstallationId: string | null;
  reordering: boolean;
  onToggle: (installationId: string, enabled: boolean) => void;
  onRefresh: (installationId: string) => void;
  onRemove: (installationId: string) => void;
  onReorder: (addons: AddonDto[]) => void;
}

export function AddonList({
  addons,
  pendingInstallationId,
  removingInstallationId,
  reordering,
  onToggle,
  onRefresh,
  onRemove,
  onReorder,
}: AddonListProps) {
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const ordered = useMemo(() => [...addons].sort((a, b) => a.priority - b.priority), [addons]);

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) {
      return;
    }
    const next = [...ordered];
    const [item] = next.splice(index, 1);
    if (!item) {
      return;
    }
    next.splice(target, 0, item);
    onReorder(next);
    setStatusMessage(`Moved ${item.name} ${direction < 0 ? "up" : "down"}.`);
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const fromIndex = ordered.findIndex((addon) => addon.id === draggingId);
    const toIndex = ordered.findIndex((addon) => addon.id === targetId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }
    const next = [...ordered];
    const [item] = next.splice(fromIndex, 1);
    if (!item) {
      return;
    }
    next.splice(toIndex, 0, item);
    onReorder(next);
    setDraggingId(null);
    setDragOverId(null);
    setStatusMessage(`Reordered ${item.name}.`);
  };

  const handleRemoveConfirm = (installationId: string) => {
    setConfirmRemoveId(null);
    onRemove(installationId);
  };

  return (
    <div className="space-y-4">
      {statusMessage ? (
        <p className="text-sm" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
      <ul role="list" aria-label="Installed add-ons" className="space-y-3">
        {ordered.map((addon, index) => {
          const busy =
            pendingInstallationId === addon.id || removingInstallationId === addon.id || reordering;
          const isDragging = draggingId === addon.id;
          const isDropTarget = dragOverId === addon.id && draggingId !== addon.id;

          return (
            <li
              key={addon.id}
              draggable={!busy}
              onDragStart={() => setDraggingId(addon.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverId(addon.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(addon.id);
              }}
              className={cn(
                "rounded-xl border bg-card p-4 shadow-sm transition-colors",
                isDragging && "opacity-60",
                isDropTarget && "border-primary ring-2 ring-primary/30",
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className="mt-1 cursor-grab text-muted-foreground active:cursor-grabbing"
                    aria-hidden
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{addon.name}</h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        v{addon.version}
                      </span>
                    </div>
                    {addon.description ? (
                      <p className="text-sm text-muted-foreground">{addon.description}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {addon.capabilities.resources.join(", ")} · priority {addon.priority + 1}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={addon.enabled}
                      disabled={busy}
                      label={`${addon.enabled ? "Disable" : "Enable"} ${addon.name}`}
                      onCheckedChange={(enabled) => onToggle(addon.id, enabled)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {addon.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Move ${addon.name} up`}
                      disabled={busy || index === 0}
                      onClick={() => handleMove(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Move ${addon.name} down`}
                      disabled={busy || index === ordered.length - 1}
                      onClick={() => handleMove(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Refresh ${addon.name}`}
                      disabled={busy}
                      onClick={() => onRefresh(addon.id)}
                    >
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          pendingInstallationId === addon.id && "animate-spin",
                        )}
                        aria-hidden
                      />
                    </Button>
                    {confirmRemoveId === addon.id ? (
                      <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-2 py-1">
                        <span className="text-xs">Remove?</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRemoveId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleRemoveConfirm(addon.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Remove ${addon.name}`}
                        disabled={busy}
                        onClick={() => setConfirmRemoveId(addon.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
