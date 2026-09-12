import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, readJsonBody, withApiErrors } from "@/lib/api-response.server";
import { createComplaint, listComplaints } from "@/lib/complaints-api.server";

export const Route = createFileRoute("/api/complaints/")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withApiErrors(async () => {
          const url = new URL(request.url);
          const result = await listComplaints(url.searchParams);
          return jsonResponse(result);
        }),
      POST: async ({ request }) =>
        withApiErrors(async () => {
          const body = await readJsonBody(request);
          const complaint = await createComplaint(body);
          return jsonResponse(complaint, 201);
        }),
    },
  },
});
