import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse, withApiErrors } from "@/lib/api-response.server";
import { escalateOverdueComplaints } from "@/lib/complaints-api.server";

/**
 * POST /api/complaints/escalate-overdue — runs the SLA-escalation sweep:
 * any open complaint whose authority hasn't responded within its severity-
 * based SLA window gets auto-escalated to that authority's real next
 * level (zonal/circle office -> regional HQ/CGRF -> Electricity
 * Ombudsman), logged to the routing timeline.
 *
 * The app already runs this sweep opportunistically whenever complaints
 * are listed/viewed, so escalation broadly keeps pace with normal traffic.
 * For escalation that fires on a strict clock regardless of whether
 * anyone is using the app, point an external scheduler at this endpoint
 * every few minutes — e.g. a cron-job.org ping, a scheduled GitHub
 * Actions workflow, or a Supabase scheduled Edge Function that just
 * fetches this URL.
 */
export const Route = createFileRoute("/api/complaints/escalate-overdue")({
  server: {
    handlers: {
      POST: async () =>
        withApiErrors(async () => {
          const result = await escalateOverdueComplaints();
          return jsonResponse(result);
        }),
    },
  },
});
