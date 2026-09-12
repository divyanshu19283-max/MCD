import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { complaintsQueryClient } from "./query-client";
import {
  advanceComplaintFn,
  updateMcdComplaintStatusFn,
  confirmResolutionFn,
  getComplaintFn,
  listAuthoritiesFn,
  listComplaintsFn,
  listRoutingEventsFn,
  markReadFn,
  reassignAuthorityFn,
  recordHandoffFn,
  recordOfficialReferenceFn,
  reopenComplaintFn,
} from "./complaints.functions";

// Public re-exports used by route modules and other UI consumers.
export { listComplaintsFn };

import type { Complaint, HandoffMethod, IssueType } from "./complaint-model";
import { getCitizenId } from "./citizen-identity";

export * from "./complaint-model";

// Direct named export: this avoids Rolldown failing to resolve formatDate
// when the module also re-exports the complaint model.
export function formatDate(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

const COMPLAINTS_QUERY_KEY = ["complaints"] as const;

/**
 * All complaint data lives in the real backend database. These helpers call
 * server functions to read/write it, then invalidate the shared query cache
 * so every component using useComplaints() re-fetches the latest state.
 */

/**
 * Subscribes once (per mounted consumer) to Supabase Realtime for the
 * `complaints` table, so status changes made by *anyone* — another tab,
 * another device, a future real-authority integration — show up live
 * instead of only after this browser's own actions invalidate the cache.
 * Safe to call from multiple components; each gets its own channel and
 * cleans up on unmount.
 */
function useComplaintsRealtime() {
  useEffect(() => {
    // Realtime is opt-in because some LAN/proxy environments block Supabase
    // WebSockets. Normal complaint mutations already invalidate React Query,
    // so the app remains fully functional without a WebSocket connection.
    if (import.meta.env["VITE_ENABLE_REALTIME"] !== "true") return;
    // Realtime is optional. Do not initialize the browser Supabase client unless
    // the browser-safe VITE credentials are actually available; local setups
    // commonly keep only SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY server-side.
    if (!import.meta.env["VITE_SUPABASE_URL"] || !import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]) {
      return;
    }

    let cancelled = false;
    let channel: import("@supabase/supabase-js").RealtimeChannel | undefined;

    import("@/integrations/supabase/client")
      .then(({ supabase }) => {
        if (cancelled) return;

        const cryptoObj = globalThis.crypto;
        const id =
          cryptoObj && typeof cryptoObj.randomUUID === "function"
            ? cryptoObj.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const nextChannel = supabase.channel(`complaints-changes-${id}`);

        nextChannel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "complaints" },
          () => {
            void complaintsQueryClient.invalidateQueries({ queryKey: COMPLAINTS_QUERY_KEY });
          },
        );

        channel = nextChannel;
        if (!cancelled) void nextChannel.subscribe();
        else void supabase.removeChannel(nextChannel);
      })
      .catch(() => {
        // Realtime is optional; failed initialization must never break the app.
      });

    return () => {
      cancelled = true;
      if (channel) {
        import("@/integrations/supabase/client")
          .then(({ supabase }) => {
            void supabase.removeChannel(channel!);
          })
          .catch(() => {});
      }
    };
  }, []);
}

export function useComplaints() {
  useComplaintsRealtime();
  const { data, isPending, isError, error, refetch } = useQuery(
    {
      queryKey: COMPLAINTS_QUERY_KEY,
      queryFn: async () => {
        const citizenId = getCitizenId();
        const res = await fetch(`/api/complaints?limit=200&offset=0&citizen_id=${encodeURIComponent(citizenId)}`, { cache: "no-store" });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`GET /api/complaints failed (${res.status}): ${detail}`);
        }
        const payload = (await res.json()) as { data?: ApiComplaint[] };
        return (payload.data ?? []).map((api) => ({
          id: api.complaint_id,
          type: api.category,
          description: api.description,
          photo: api.evidence_url,
          lat: api.latitude,
          lng: api.longitude,
          area: api.address,
          ward: "",
          createdAt: new Date(api.created_at).getTime(),
          status: api.status as Complaint["status"],
          timeline: [],
          read: true,
          problem: api.classification,
          severity: api.severity as Complaint["severity"],
          authority: api.assigned_authority?.name ?? "",
          recommendedAction: "",
          expectedBy: 0,
          priorityScore: api.priority_score,
          priorityReasoning: api.priority_reasoning,
          forwardedAt: api.mcd_reference ? new Date(api.updated_at).getTime() : null,
          forwardedReference: api.mcd_reference ?? null,
          citizenConfirmedAt: null,
          reopenedCount: 0,
          assignedAuthorityId: api.assigned_authority?.id ?? null,
          assignedAuthorityName: api.assigned_authority?.name ?? null,
          assignedOffice: api.assigned_authority?.office ?? null,
          assignedContact: api.assigned_authority?.contact ?? null,
          routingDistanceKm: api.assigned_authority?.distance_km ?? null,
          escalationLevel: api.escalation_level ?? 1,
          routingStatus: (api.routing_status as Complaint["routingStatus"]) ?? "unassigned",
          routingSlaDeadline: null,
          mcdCategoryId: api.mcd_category_id ?? null,
          mcdSubcategoryId: api.mcd_subcategory_id ?? null,
        }));
      },
      staleTime: 0,
    },
    complaintsQueryClient,
  );
  return { list: data ?? [], loaded: !isPending, isError, error, refetch };
}

/** Loads a single complaint straight from the database by its complaint ID
 * — used by the complaint detail page so a direct link always resolves
 * against the real record instead of depending on the full list being
 * cached client-side first. `data` is `undefined` while loading, and
 * `null` once loaded if no such complaint exists. */
export function useComplaint(id: string | undefined) {
  useComplaintsRealtime();
  const { data, isPending } = useQuery(
    {
      queryKey: [...COMPLAINTS_QUERY_KEY, id, "private-aware"],
      queryFn: async () => {
        const citizenId = getCitizenId();
        const res = await fetch(`/api/complaints/${encodeURIComponent(id!)}?citizen_id=${encodeURIComponent(citizenId)}`, { cache: "no-store" });
        if (!res.ok) return null;
        const api = (await res.json()) as ApiComplaint;
        return {
          id: api.complaint_id,
          type: api.category,
          description: api.description,
          photo: api.evidence_url,
          lat: api.latitude,
          lng: api.longitude,
          area: api.address,
          ward: "",
          createdAt: new Date(api.created_at).getTime(),
          status: api.status as Complaint["status"],
          timeline: [],
          read: true,
          problem: api.classification,
          severity: api.severity as Complaint["severity"],
          authority: api.assigned_authority?.name ?? "",
          recommendedAction: "",
          expectedBy: 0,
          priorityScore: api.priority_score,
          priorityReasoning: api.priority_reasoning,
          forwardedAt: api.mcd_reference ? new Date(api.updated_at).getTime() : null,
          forwardedReference: api.mcd_reference ?? null,
          citizenConfirmedAt: null,
          reopenedCount: 0,
          assignedAuthorityId: api.assigned_authority?.id ?? null,
          assignedAuthorityName: api.assigned_authority?.name ?? null,
          assignedOffice: api.assigned_authority?.office ?? null,
          assignedContact: api.assigned_authority?.contact ?? null,
          routingDistanceKm: api.assigned_authority?.distance_km ?? null,
          escalationLevel: api.escalation_level ?? 1,
          routingStatus: (api.routing_status as Complaint["routingStatus"]) ?? "unassigned",
          routingSlaDeadline: null,
          mcdCategoryId: api.mcd_category_id ?? null,
          mcdSubcategoryId: api.mcd_subcategory_id ?? null,
        } satisfies Complaint;
      },
      enabled: Boolean(id),
      staleTime: 0,
    },
    complaintsQueryClient,
  );
  const refetch = async () => {
    await complaintsQueryClient.invalidateQueries({ queryKey: [...COMPLAINTS_QUERY_KEY, id, "private-aware"] });
  };
  return { complaint: data ?? null, loaded: id ? !isPending : true, refetch };
}

export function useMajorComplaints() {
  useComplaintsRealtime();
  const { data, isPending, isError, error, refetch } = useQuery(
    {
      queryKey: [...COMPLAINTS_QUERY_KEY, "major"],
      queryFn: async () => {
        const citizenId = getCitizenId();
        const res = await fetch(`/api/complaints/major?limit=200&citizen_id=${encodeURIComponent(citizenId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`GET /api/complaints/major failed (${res.status})`);
        const payload = (await res.json()) as { data?: ApiComplaint[] };
        return (payload.data ?? []).map((api) => ({
          id: api.complaint_id, type: api.category, description: api.description, photo: api.evidence_url,
          lat: api.latitude, lng: api.longitude, area: api.address, ward: "",
          createdAt: new Date(api.created_at).getTime(), status: api.status as Complaint["status"], timeline: [], read: true,
          problem: api.classification, severity: api.severity as Complaint["severity"], authority: api.assigned_authority?.name ?? "",
          recommendedAction: "", expectedBy: 0, priorityScore: api.priority_score, priorityReasoning: api.priority_reasoning,
          forwardedAt: api.mcd_reference ? new Date(api.updated_at).getTime() : null, forwardedReference: api.mcd_reference ?? null,
          citizenConfirmedAt: null, reopenedCount: 0, assignedAuthorityId: api.assigned_authority?.id ?? null,
          assignedAuthorityName: api.assigned_authority?.name ?? null, assignedOffice: api.assigned_authority?.office ?? null,
          assignedContact: api.assigned_authority?.contact ?? null, routingDistanceKm: api.assigned_authority?.distance_km ?? null,
          escalationLevel: api.escalation_level ?? 1, routingStatus: (api.routing_status as Complaint["routingStatus"]) ?? "unassigned",
          routingSlaDeadline: null, mcdCategoryId: api.mcd_category_id ?? null, mcdSubcategoryId: api.mcd_subcategory_id ?? null,
        } satisfies Complaint));
      }, staleTime: 0,
    }, complaintsQueryClient,
  );
  return { list: data ?? [], loaded: !isPending, isError, error, refetch };
}

export async function updateMcdComplaintStatus(
  id: string,
  status: Complaint["status"],
  note?: string,
) {
  const updated = await updateMcdComplaintStatusFn({ data: { id, status, note } });
  await invalidateComplaints();
  return updated;
}

async function invalidateComplaints() {
  await complaintsQueryClient.invalidateQueries({ queryKey: COMPLAINTS_QUERY_KEY });
}

/** Response shape of POST /api/complaints. */
type ApiComplaint = {
  id: string;
  complaint_id: string;
  category: IssueType;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  severity: string;
  classification: string;
  priority_score: number;
  priority_reasoning: string;
  status: string;
  evidence_url: string | null;
  created_at: string;
  updated_at: string;
  assigned_authority?: {
    id: string | null;
    name: string | null;
    office: string | null;
    contact: string | null;
    distance_km: number | null;
  };
  escalation_level?: number;
  routing_status?: string;
  mcd_reference?: string | null;
  mcd_category_id?: number | null;
  mcd_subcategory_id?: number | null;
};

/**
 * Saves a complaint by posting the report form straight to the real REST
 * backend — POST /api/complaints with { type, description, photo, lat,
 * lng, area } — and returns the stored record, with its permanent
 * complaint ID. The response is mapped back onto the app's Complaint
 * model so callers don't change.
 */
export async function createComplaint(input: {
  type: IssueType;
  description: string;
  photo: string | null;
  lat: number;
  lng: number;
  area?: string;
  firstName: string;
  lastName?: string;
  mobile: string;
  email: string;
  mcdCategoryId: number;
  mcdSubcategoryId: number;
  citizenId?: string;
}): Promise<Complaint> {
  const payload = JSON.stringify({
    type: input.type,
    description: input.description,
    photo: input.photo,
    lat: input.lat,
    lng: input.lng,
    ...(input.area ? { area: input.area } : {}),
    firstName: input.firstName,
    ...(input.lastName ? { lastName: input.lastName } : {}),
    mobile: input.mobile,
    email: input.email,
    mcdCategoryId: input.mcdCategoryId,
    mcdSubcategoryId: input.mcdSubcategoryId,
    citizenId: input.citizenId ?? getCitizenId(),
  });

  // Prefer the canonical route. The trailing-slash retry protects POSTs in
  // deployments whose router does not preserve POST bodies across redirects.
  let res = await fetch("/api/complaints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });

  if (res.status === 404 || res.status === 405) {
    res = await fetch("/api/complaints/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
  }

  if (!res.ok) {
    let message = `POST /api/complaints failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; details?: unknown };
      if (body.error) message += `: ${body.error}`;
      if (body.details) message += ` — ${JSON.stringify(body.details)}`;
    } catch {
      const detail = await res.text().catch(() => "");
      if (detail) message += `: ${detail}`;
    }
    throw new Error(message);
  }

  const api = (await res.json()) as ApiComplaint;
  await invalidateComplaints();
  // The list cache is invalidated above and holds the full record; this
  // maps the REST response back to the Complaint shape the report page
  // needs (public complaint ID + classification) for its confirmation.
  return {
    id: api.complaint_id,
    type: api.category,
    description: api.description,
    photo: api.evidence_url,
    lat: api.latitude,
    lng: api.longitude,
    area: api.address,
    ward: "",
    createdAt: new Date(api.created_at).getTime(),
    status: api.status as Complaint["status"],
    timeline: [],
    read: true,
    problem: api.classification,
    severity: api.severity as Complaint["severity"],
    authority: "",
    recommendedAction: "",
    expectedBy: 0,
    priorityScore: api.priority_score,
    priorityReasoning: api.priority_reasoning,
    forwardedAt: api.mcd_reference ? Date.now() : null,
    forwardedReference: api.mcd_reference ?? null,
    citizenConfirmedAt: null,
    reopenedCount: 0,
    assignedAuthorityId: api.assigned_authority?.id ?? null,
    assignedAuthorityName: api.assigned_authority?.name ?? null,
    assignedOffice: api.assigned_authority?.office ?? null,
    assignedContact: api.assigned_authority?.contact ?? null,
    routingDistanceKm: api.assigned_authority?.distance_km ?? null,
    escalationLevel: api.escalation_level ?? 1,
    routingStatus: (api.routing_status as Complaint["routingStatus"]) ?? "unassigned",
    routingSlaDeadline: null,
    mcdCategoryId: api.mcd_category_id ?? null,
    mcdSubcategoryId: api.mcd_subcategory_id ?? null,
  };
}

/** Advances a complaint to its next lifecycle status, logging a timeline entry. */
export async function advance(id: string) {
  await advanceComplaintFn({ data: { id } });
  await invalidateComplaints();
}

/**
 * Records that the citizen used a real contact action (call, email, the
 * authority's official page, or copying its details) for the assigned
 * authority. Fire-and-forget from the caller's perspective — this only
 * logs the outreach on the routing timeline, it never blocks or changes
 * the tel:/mailto:/external-link navigation that triggered it.
 */
export async function recordHandoff(id: string, method: HandoffMethod) {
  await recordHandoffFn({ data: { id, method } });
}

/**
 * Records the real reference/complaint number the citizen received after
 * actually contacting the assigned authority themselves — moves the
 * complaint to "Forwarded to Authority" if it hasn't reached that stage
 * yet. No real authority is ever contacted on the citizen's behalf; this
 * only records what the citizen reports back.
 */
export async function recordOfficialReference(
  id: string,
  reference: string,
): Promise<Complaint | null> {
  const result = await recordOfficialReferenceFn({ data: { id, reference } });
  await invalidateComplaints();
  return result;
}

export async function markRead(id: string) {
  await markReadFn({ data: { id } });
  await invalidateComplaints();
}

/** Citizen confirms a "Resolved" complaint is actually fixed — records the
 * outcome and closes the loop on the lifecycle. */
export async function confirmResolution(id: string) {
  const result = await confirmResolutionFn({ data: { id } });
  await invalidateComplaints();
  return result;
}

/** Citizen reports a "Resolved" complaint is NOT actually fixed — reopens
 * it (back to "Work In Progress") and records the reopen in the outcome. */
export async function reopenComplaint(id: string) {
  const result = await reopenComplaintFn({ data: { id } });
  await invalidateComplaints();
  return result;
}

const ROUTING_QUERY_KEY = ["routing-events"] as const;

/** Live routing/escalation timeline for a complaint — assignment,
 * acknowledgement, SLA escalation and any admin reassignment. Polls
 * lightly since escalation can happen server-side between visits, and
 * listens on the same realtime channel as complaints (routing events are
 * published on the same `supabase_realtime` publication). */
export function useRoutingEvents(id: string | undefined) {
  useComplaintsRealtime();
  const { data, isPending } = useQuery(
    {
      queryKey: [...ROUTING_QUERY_KEY, id],
      queryFn: () => listRoutingEventsFn({ data: { id: id! } }),
      enabled: Boolean(id),
      staleTime: 0,
      refetchInterval: 60_000,
    },
    complaintsQueryClient,
  );
  return { events: data ?? [], loaded: id ? !isPending : true };
}

/** Active authorities in the directory that can handle a given issue type
 * — used to populate the admin override reassignment control with real,
 * valid targets only. */
export function useAuthorities(issueType: IssueType | undefined) {
  const { data, isPending } = useQuery(
    {
      queryKey: ["authorities", issueType],
      queryFn: () => listAuthoritiesFn({ data: { issueType } }),
      staleTime: 60_000,
    },
    complaintsQueryClient,
  );
  return { authorities: data ?? [], loaded: !isPending };
}

/** Admin override: reassigns a complaint to a specific authority from the
 * directory, regardless of the automatic nearest-office match. */
export async function reassignAuthority(id: string, authorityId: string, note?: string) {
  const result = await reassignAuthorityFn({ data: { id, authorityId, note } });
  await invalidateComplaints();
  await complaintsQueryClient.invalidateQueries({ queryKey: [...ROUTING_QUERY_KEY, id] });
  return result;
}
