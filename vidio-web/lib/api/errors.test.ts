import { describe, expect, it } from "vitest";
import { ApiError, problemToApiError } from "@/lib/api/errors";

describe("ApiError", () => {
  it("maps RFC 9457 problem JSON", () => {
    const error = problemToApiError({
      type: "/errors/validation",
      title: "Validation failed",
      status: 422,
      detail: "Email is invalid",
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.isValidation).toBe(true);
    expect(error.message).toBe("Email is invalid");
  });
});
