import { ApiError } from "./complaints-api.server";

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Runs an API handler body and converts any thrown ApiError (or unexpected
 * error) into a well-formed JSON error response, so every route file stays
 * a thin one-liner per HTTP method. */
export async function withApiErrors(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonResponse({ error: err.message, details: err.details }, err.status);
    }
    console.error("[api] unhandled error:", err);
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : "Internal server error",
      },
      500,
    );
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
