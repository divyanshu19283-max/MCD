import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, withApiErrors } from "@/lib/api-response.server";
import { listNearbyComplaints } from "@/lib/complaints-api.server";

export const Route = createFileRoute("/api/complaints/nearby")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withApiErrors(async () => {
          const url = new URL(request.url);
          const result = await listNearbyComplaints(url.searchParams);
          return jsonResponse(result);
        }),
    },
  },
});
