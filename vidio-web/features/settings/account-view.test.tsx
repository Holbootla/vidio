import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountView } from "@/features/settings/account-view";
import { server } from "@/test/server";
import { useAuthStore } from "@/lib/auth/store";

const logoutMutate = vi.fn();

vi.mock("@/features/auth/use-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/auth/use-auth")>();
  return {
    ...actual,
    useLogoutMutation: () => ({
      mutate: logoutMutate,
      isPending: false,
    }),
  };
});

function renderAccount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AccountView profileName="Main" />
    </QueryClientProvider>,
  );
}

describe("AccountView", () => {
  beforeEach(() => {
    logoutMutate.mockReset();
    useAuthStore.setState({
      accessToken: "access-token",
      accessExpiresAt: "2026-12-31T23:59:59Z",
      profile: null,
      isBootstrapped: true,
    });
  });

  it("shows email and status from /v1/me", async () => {
    renderAccount();

    await waitFor(() => {
      expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
    expect(screen.getByText("Main")).toBeInTheDocument();
  });

  it("does not render sessions or devices UI", async () => {
    renderAccount();

    await waitFor(() => expect(screen.getByText("viewer@example.com")).toBeInTheDocument());

    expect(screen.queryByRole("heading", { name: /sessions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /devices/i })).not.toBeInTheDocument();
    expect(screen.getByText(/not available in web v1/i)).toBeInTheDocument();
  });

  it("calls logout mutation", async () => {
    const user = userEvent.setup();
    renderAccount();

    await waitFor(() => expect(screen.getByText("viewer@example.com")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Sign out/i }));

    expect(logoutMutate).toHaveBeenCalledTimes(1);
  });

  it("shows error state when /v1/me fails", async () => {
    server.use(
      http.get("http://localhost:8080/v1/me", () =>
        HttpResponse.json(
          {
            type: "/errors/internal",
            title: "Server error",
            status: 500,
          },
          { status: 500, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    renderAccount();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Could not load account/i);
    });
  });
});
