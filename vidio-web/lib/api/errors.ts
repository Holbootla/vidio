import { problemJsonSchema, type ProblemJson } from "@/lib/api/schemas";

export class ApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly detail?: string;

  constructor(problem: ProblemJson) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
    this.status = problem.status;
    this.type = problem.type;
    this.title = problem.title;
    this.detail = problem.detail;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isValidation(): boolean {
    return this.type.includes("validation") || this.status === 422;
  }
}

export function problemToApiError(problem: ProblemJson): ApiError {
  return new ApiError(problem);
}

export async function parseProblemJson(response: Response): Promise<ApiError | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/problem+json")) {
    return null;
  }

  try {
    const json: unknown = await response.json();
    const parsed = problemJsonSchema.safeParse(json);
    if (parsed.success) {
      return problemToApiError(parsed.data);
    }
  } catch {
    return null;
  }

  return null;
}

export async function errorFromResponse(response: Response): Promise<ApiError> {
  const problemError = await parseProblemJson(response);
  if (problemError) {
    return problemError;
  }

  return new ApiError({
    type: "/errors/unknown",
    title: response.statusText || "Request failed",
    status: response.status,
    detail: `HTTP ${response.status}`,
  });
}
