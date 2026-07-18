import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { serverLogin, serverLogout, serverRefresh, serverRegister } from "@/lib/auth/server-api";

describe("server auth API", () => {
  it("logs in successfully", async () => {
    const auth = await serverLogin({
      email: "viewer@example.com",
      password: "secret",
    });
    expect(auth.access_token).toBe("access-token");
    expect(auth.profile.name).toBe("Main");
  });

  it("returns RFC 9457 error for invalid login", async () => {
    await expect(
      serverLogin({ email: "viewer@example.com", password: "wrong" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("refreshes tokens", async () => {
    const auth = await serverRefresh("refresh-token");
    expect(auth.access_token).toBe("access-token");
  });

  it("rejects expired refresh tokens", async () => {
    await expect(serverRefresh("expired")).rejects.toBeInstanceOf(ApiError);
  });

  it("logs out with 204", async () => {
    await expect(serverLogout("refresh-token")).resolves.toBeUndefined();
  });

  it("registers a user without tokens", async () => {
    const response = await serverRegister({
      email: "new@example.com",
      password: "password123",
      profile_name: "Main",
    });
    expect(response.user.email).toBe("new@example.com");
    expect(response.profile.name).toBe("Main");
  });
});
