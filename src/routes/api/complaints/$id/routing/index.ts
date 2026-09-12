import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, withApiErrors } from "@/lib/api-response.server";
import { getComplaintRouting } from "@/lib/complaints-api.server";

/** GET /api/complaints/:id/routing — current authority assignment
 * (department, office, distance, contact, status) plus the full
 * assignment/escalation timeline for a complaint. */
export const Route = createFileRoute("/api/complaints/$id/routing/")({
  server: {
    handlers: {
      GET: async ({ params }) =>
        withApiErrors(async () => {
          const routing = await getComplaintRouting(params.id);
          return jsonResponse(routing);
        }),
    },
  },
});
