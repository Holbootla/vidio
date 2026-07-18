import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth/LoginForm";
import { ApiError } from "@/lib/api/errors";
import messages from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/features/auth/use-auth", () => ({
  useLoginMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: new ApiError({
      type: "/errors/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "Invalid credentials",
    }),
  }),
}));

function renderWithIntl(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("LoginForm", () => {
  it("surfaces API validation errors", () => {
    renderWithIntl(<LoginForm />);
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
  });
});
