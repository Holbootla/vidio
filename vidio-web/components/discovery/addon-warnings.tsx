"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AddonWarning } from "@/lib/api/schemas";

interface AddonWarningsProps {
  warnings: AddonWarning[];
}

export function AddonWarnings({ warnings }: AddonWarningsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = warnings.filter(
    (warning) => !dismissed.has(`${warning.installation_id}:${warning.message}`),
  );

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {visible.map((warning) => {
        const key = `${warning.installation_id}:${warning.message}`;
        return (
          <div
            key={key}
            className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{warning.addon_name}</p>
              <p className="text-muted-foreground">{warning.message}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label={`Dismiss warning from ${warning.addon_name}`}
              onClick={() => setDismissed((prev) => new Set(prev).add(key))}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
