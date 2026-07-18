import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRef } from "react";
import { useGridArrowNavigation } from "@/lib/hooks/use-grid-arrow-navigation";

function GridFixture({ columns }: { columns: number }) {
  const ref = useRef<HTMLUListElement>(null);
  useGridArrowNavigation(ref, { columns });

  return (
    <ul ref={ref}>
      <li>
        <a href="/1">One</a>
      </li>
      <li>
        <a href="/2">Two</a>
      </li>
      <li>
        <a href="/3">Three</a>
      </li>
      <li>
        <a href="/4">Four</a>
      </li>
    </ul>
  );
}

describe("useGridArrowNavigation", () => {
  it("moves focus with arrow keys", () => {
    render(<GridFixture columns={2} />);

    const links = Array.from(document.querySelectorAll("a"));
    links[0]?.focus();
    expect(document.activeElement).toBe(links[0]);

    links[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.activeElement).toBe(links[1]);

    links[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(links[3]);
  });
});
