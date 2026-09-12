import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, withApiErrors } from "@/lib/api-response.server";
import { listMajorComplaints } from "@/lib/complaints-api.server";

export const Route = createFileRoute("/api/complaints/major")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withApiErrors(async () => {
          const url = new URL(request.url);
          return jsonResponse(await listMajorComplaints(url.searchParams));
        }),
    },
  },
});
