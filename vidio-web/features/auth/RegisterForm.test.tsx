import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { RegisterForm } from "@/features/auth/RegisterForm";
import { ApiError } from "@/lib/api/errors";
import messages from "@/messages/en.json";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/features/auth/use-auth", () => ({
  useRegisterMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: new ApiError({
      type: "/errors/validation",
      title: "Validation failed",
      status: 422,
      detail: "Email already registered",
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

describe("RegisterForm", () => {
  it("surfaces API validation errors", () => {
    renderWithIntl(<RegisterForm />);
    expect(screen.getByRole("alert")).toHaveTextContent("Email already registered");
  });
});
