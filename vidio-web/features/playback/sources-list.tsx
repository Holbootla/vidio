"use client";

import { cn } from "@/lib/utils/cn";
import type { ProcessedSource, SourceGroup } from "@/lib/player/source-selection";

interface SourcesListProps {
  groups: SourceGroup[];
  selectedSourceId?: string | null;
  onSelect?: (source: ProcessedSource) => void;
  name?: string;
}

export function SourcesList({
  groups,
  selectedSourceId,
  onSelect,
  name = "sources",
}: SourcesListProps) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        No sources available for this title.
      </p>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Playback sources"
      className="space-y-4"
      data-testid={`${name}-list`}
    >
      {groups.map((group) => (
        <section key={group.installationId} aria-labelledby={`${name}-${group.installationId}`}>
          <h3
            id={`${name}-${group.installationId}`}
            className="mb-2 text-sm font-medium text-muted-foreground"
          >
            {group.addonName}
          </h3>
          <ul role="list" className="space-y-2">
            {group.sources.map((source) => {
              const selected = selectedSourceId === source.id;
              const inputId = `${name}-${source.id}`;
              return (
                <li key={source.id}>
                  <label
                    htmlFor={inputId}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors",
                      source.disabled
                        ? "cursor-not-allowed opacity-60"
                        : "hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring",
                      selected && !source.disabled ? "border-primary bg-accent/40" : "bg-card",
                    )}
                    title={source.disableReason ?? undefined}
                    aria-description={source.disableReason ?? undefined}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={name}
                      value={source.id}
                      checked={selected}
                      disabled={source.disabled}
                      onChange={() => onSelect?.(source)}
                      className="mt-1"
                      aria-label={source.label}
                    />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block text-sm font-medium">{source.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {source.playable === "youtube"
                          ? "YouTube"
                          : source.playable === "external"
                            ? "External link"
                            : source.playable === "vidstack"
                              ? "Web player"
                              : "Unavailable"}
                      </span>
                      {source.disableReason ? (
                        <span className="block text-xs text-destructive">
                          {source.disableReason}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
