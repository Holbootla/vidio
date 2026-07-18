"use client";

import { useCallback, useEffect, type RefObject } from "react";
import { isEditableTarget } from "@/lib/hooks/is-editable-target";

export interface GridArrowNavigationOptions {
  columns: number;
  itemSelector?: string;
}

function getFocusableItems(container: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1,
  );
}

export function useGridArrowNavigation(
  containerRef: RefObject<HTMLElement | null>,
  { columns, itemSelector = "a[href]" }: GridArrowNavigationOptions,
): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!containerRef.current || isEditableTarget(event.target)) {
        return;
      }

      const { key } = event;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) {
        return;
      }

      const items = getFocusableItems(containerRef.current, itemSelector);
      if (items.length === 0) {
        return;
      }

      const active = document.activeElement;
      const currentIndex = items.findIndex((item) => item === active);
      if (currentIndex === -1) {
        return;
      }

      let nextIndex = currentIndex;
      const columnCount = Math.max(1, columns);

      switch (key) {
        case "ArrowLeft":
          nextIndex = Math.max(0, currentIndex - 1);
          break;
        case "ArrowRight":
          nextIndex = Math.min(items.length - 1, currentIndex + 1);
          break;
        case "ArrowUp":
          nextIndex = Math.max(0, currentIndex - columnCount);
          break;
        case "ArrowDown":
          nextIndex = Math.min(items.length - 1, currentIndex + columnCount);
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = items.length - 1;
          break;
      }

      if (nextIndex !== currentIndex) {
        event.preventDefault();
        items[nextIndex]?.focus();
      }
    },
    [columns, containerRef, itemSelector],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, handleKeyDown]);
}
