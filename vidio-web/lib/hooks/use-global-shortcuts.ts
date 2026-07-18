"use client";

import { useEffect } from "react";
import { isEditableTarget } from "@/lib/hooks/is-editable-target";

export interface GlobalShortcutHandlers {
  onFocusSearch?: () => void;
  onEscape?: () => void;
}

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "Escape") {
        handlers.onEscape?.();
        return;
      }

      if (event.key === "/" && !isEditableTarget(event.target)) {
        event.preventDefault();
        handlers.onFocusSearch?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
