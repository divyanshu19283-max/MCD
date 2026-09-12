import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, withApiErrors } from "@/lib/api-response.server";
import { listAuthorities } from "@/lib/complaints-api.server";

/** GET /api/authorities?category=Power%20Outage — the real MCD/DISCOM
 * office directory complaints are routed against, optionally filtered to
 * offices that handle a given issue category. */
export const Route = createFileRoute("/api/authorities/")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withApiErrors(async () => {
          const url = new URL(request.url);
          const authorities = await listAuthorities(url.searchParams);
          return jsonResponse(authorities);
        }),
    },
  },
});
