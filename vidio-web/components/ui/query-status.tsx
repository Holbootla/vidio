"use client";

import { AlertCircle } from "lucide-react";

interface QueryStatusProps {
  title: string;
  message?: string;
}

export function QueryErrorState({ title, message }: QueryStatusProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {message ? <p className="text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}

export function QueryLoadingState({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
      {label}
    </p>
  );
}
