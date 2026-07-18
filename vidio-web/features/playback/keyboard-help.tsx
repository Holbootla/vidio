"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";

interface KeyboardHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: "Space / K", action: "Play or pause" },
  { keys: "J / Left arrow", action: "Seek backward 10 seconds" },
  { keys: "L / Right arrow", action: "Seek forward 10 seconds" },
  { keys: "M", action: "Mute or unmute" },
  { keys: "F", action: "Toggle fullscreen" },
  { keys: "C", action: "Toggle captions" },
  { keys: "?", action: "Show or hide this help" },
];

export function KeyboardHelp({ open, onClose }: KeyboardHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="keyboard-help-title" className="text-lg font-semibold">
            Keyboard shortcuts
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <dl className="space-y-3">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-center justify-between gap-4">
              <dt className="font-mono text-sm">{shortcut.keys}</dt>
              <dd className="text-sm text-muted-foreground">{shortcut.action}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
