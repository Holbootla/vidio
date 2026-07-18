import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "@/lib/hooks/use-global-shortcuts";

describe("useGlobalShortcuts", () => {
  it("calls onFocusSearch for / outside editable targets", () => {
    const onFocusSearch = vi.fn();
    renderHook(() => useGlobalShortcuts({ onFocusSearch }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    expect(onFocusSearch).toHaveBeenCalledTimes(1);
  });

  it("ignores / when focus is in an input", () => {
    const onFocusSearch = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useGlobalShortcuts({ onFocusSearch }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    expect(onFocusSearch).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it("calls onEscape for Escape", () => {
    const onEscape = vi.fn();
    renderHook(() => useGlobalShortcuts({ onEscape }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
