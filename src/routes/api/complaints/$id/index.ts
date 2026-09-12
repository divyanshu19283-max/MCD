import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, withApiErrors } from "@/lib/api-response.server";
import { getComplaint } from "@/lib/complaints-api.server";

export const Route = createFileRoute("/api/complaints/$id/")({
  server: {
    handlers: {
      GET: async ({ params, request }) =>
        withApiErrors(async () => {
          const citizenId = new URL(request.url).searchParams.get("citizen_id") ?? undefined;
          const complaint = await getComplaint(params.id, citizenId);
          return jsonResponse(complaint);
        }),
    },
  },
});
