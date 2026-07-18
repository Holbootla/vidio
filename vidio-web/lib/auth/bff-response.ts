import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { ZodError } from "zod";

export function problemResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        type: error.type,
        title: error.title,
        status: error.status,
        detail: error.detail,
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        type: "/errors/validation",
        title: "Validation failed",
        status: 422,
        detail: error.issues.map((issue) => issue.message).join("; "),
      },
      { status: 422 },
    );
  }

  return NextResponse.json(
    {
      type: "/errors/internal",
      title: "Internal server error",
      status: 500,
      detail: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 },
  );
}
