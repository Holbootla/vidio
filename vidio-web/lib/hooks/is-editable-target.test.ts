import { describe, expect, it } from "vitest";
import { isEditableTarget } from "@/lib/hooks/is-editable-target";

describe("isEditableTarget", () => {
  it("returns true for inputs and textareas", () => {
    const input = document.createElement("input");
    expect(isEditableTarget(input)).toBe(true);
  });

  it("returns false for non-editable elements", () => {
    const div = document.createElement("div");
    expect(isEditableTarget(div)).toBe(false);
  });
});
