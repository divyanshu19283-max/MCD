import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, readJsonBody, withApiErrors } from "@/lib/api-response.server";
import { updateComplaintStatus } from "@/lib/complaints-api.server";

export const Route = createFileRoute("/api/complaints/$id/status")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) =>
        withApiErrors(async () => {
          const body = await readJsonBody(request);
          const complaint = await updateComplaintStatus(params.id, body);
          return jsonResponse(complaint);
        }),
    },
  },
});
