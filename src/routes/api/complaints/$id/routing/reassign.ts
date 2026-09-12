import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, readJsonBody, withApiErrors } from "@/lib/api-response.server";
import { reassignComplaintAuthority } from "@/lib/complaints-api.server";

/**
 * POST /api/complaints/:id/routing/reassign — admin override: manually
 * reassigns a complaint to a specific real authority from the directory,
 * bypassing the automatic nearest-office match. Body: { authority_id,
 * note?, actor? }.
 *
 * NOTE: this app has no authentication system anywhere (every route is
 * open, matching the rest of the demo), so this is not access-controlled
 * server-side — the admin gate in the UI (RoutingPanel) is a visibility
 * toggle, not real auth. Put this behind real authentication before
 * exposing it beyond a trusted/internal deployment.
 */
export const Route = createFileRoute("/api/complaints/$id/routing/reassign")({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        withApiErrors(async () => {
          const body = await readJsonBody(request);
          const routing = await reassignComplaintAuthority(params.id, body);
          return jsonResponse(routing);
        }),
    },
  },
});
