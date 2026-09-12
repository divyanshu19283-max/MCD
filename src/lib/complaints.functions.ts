import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CITIZEN_CONFIRMED_NOTE,
  CITIZEN_REOPENED_NOTE,
  HANDOFF_LABEL,
  HANDOFF_METHODS,
  ISSUE_TYPES,
  STATUSES,
  classifyComplaint,
  noteFor,
  wardFor,
  type Complaint,
  type Severity,
  type Status,
  type StatusEvent,
} from "./complaint-model";

/**
 * Real backend: every complaint lives in the Lovable Cloud Postgres database.
 * Reads and writes go through these server functions, which use the
 * service-role client so writes are impossible to forge from the browser
 * (the table only allows public reads via RLS).
 */

type Row = {
  id: string;
  code: string;
  type: string;
  description: string;
  photo_url: string | null;
  lat: number;
  lng: number;
  area: string;
  ward: string;
  created_at: string;
  status: string;
  timeline: unknown;
  read: boolean;
  problem: string;
  severity: string;
  authority: string;
  recommended_action: string;
  expected_by: string;
  priority_score: number;
  priority_reasoning: string;
  forwarded_at: string | null;
  forwarded_reference: string | null;
  citizen_confirmed_at: string | null;
  reopened_count: number;
  assigned_authority_id: string | null;
  assigned_authority_name: string | null;
  assigned_office: string | null;
  assigned_contact: string | null;
  routing_distance_km: number | null;
  escalation_level: number;
  routing_status: string;
  routing_sla_deadline: string | null;
};

function rowToComplaint(row: Row): Complaint {
  return {
    id: row.code,
    type: row.type as Complaint["type"],
    description: row.description,
    photo: row.photo_url,
    lat: row.lat,
    lng: row.lng,
    area: row.area,
    ward: row.ward,
    createdAt: new Date(row.created_at).getTime(),
    status: row.status as Status,
    timeline: (Array.isArray(row.timeline) ? row.timeline : []) as StatusEvent[],
    read: row.read,
    problem: row.problem,
    severity: row.severity as Severity,
    authority: row.authority,
    recommendedAction: row.recommended_action,
    expectedBy: new Date(row.expected_by).getTime(),
    priorityScore: row.priority_score,
    priorityReasoning: row.priority_reasoning,
    forwardedAt: row.forwarded_at ? new Date(row.forwarded_at).getTime() : null,
    forwardedReference: row.forwarded_reference,
    citizenConfirmedAt: row.citizen_confirmed_at
      ? new Date(row.citizen_confirmed_at).getTime()
      : null,
    reopenedCount: row.reopened_count ?? 0,
    assignedAuthorityId: row.assigned_authority_id ?? null,
    assignedAuthorityName: row.assigned_authority_name ?? null,
    assignedOffice: row.assigned_office ?? null,
    assignedContact: row.assigned_contact ?? null,
    routingDistanceKm: row.routing_distance_km ?? null,
    escalationLevel: row.escalation_level ?? 1,
    routingStatus: (row.routing_status as Complaint["routingStatus"]) ?? "unassigned",
    routingSlaDeadline: row.routing_sla_deadline
      ? new Date(row.routing_sla_deadline).getTime()
      : null,
    mcdCategoryId: (row as any).mcd_category_id ?? null,
    mcdSubcategoryId: (row as any).mcd_subcategory_id ?? null,
  };
}

/**
 * Opportunistic SLA-escalation sweep — runs on ordinary complaint reads
 * (list/detail) so overdue assignments get escalated as the app is used,
 * without requiring a separate cron process. Never allowed to fail a read:
 * errors are logged and swallowed. For guaranteed, traffic-independent
 * escalation, schedule POST /api/complaints/escalate-overdue externally
 * (see that route's comment).
 */
async function sweepOverdueRouting(): Promise<void> {
  try {
    const { runEscalationSweep } = await import("./routing.server");
    await runEscalationSweep();
  } catch (err) {
    console.error("[routing] escalation sweep failed:", err);
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function fetchByCode(code: string): Promise<Row | null> {
  const db = await admin();
  const { data, error } = await db.from("complaints").select("*").eq("code", code).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Row | null) ?? null;
}

/** Fetches every stored complaint, newest first. */
export const listComplaintsFn = createServerFn({ method: "GET" }).handler(async () => {
  await sweepOverdueRouting();
  const db = await admin();
  const { data, error } = await db
    .from("complaints")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(rowToComplaint);
});

const idSchema = z.object({ id: z.string().min(1) });

/** Fetches a single complaint by its public complaint ID (e.g. "LF-1001"),
 * straight from the database — used by the complaint detail page instead
 * of filtering the full list, so a direct/deep link always resolves
 * against the current record rather than whatever happens to already be
 * cached client-side. Returns null (not an error) when the ID doesn't
 * exist, so the UI can show its normal "not found" state. */
export const getComplaintFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    await sweepOverdueRouting();
    const row = await fetchByCode(data.id);
    return row ? rowToComplaint(row) : null;
  });

const EVIDENCE_BUCKET = "complaint-evidence";

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function safeRandomId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") return cryptoObj.randomUUID();
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Uploads a base64 data-URL photo (as captured by the report form) to
 * persistent Supabase Storage and returns its public URL — this is the
 * "real" evidence storage, replacing the old approach of saving the raw
 * base64 string straight into the database row. Runs with the service-role
 * client, so the upload can never be forged or pointed at another bucket
 * from the browser.
 */
async function uploadEvidencePhoto(dataUrl: string): Promise<string> {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error("Evidence photo must be a JPEG, PNG, WEBP or GIF image.");
  }
  const [, mime, base64] = match;
  const ext = EXT_BY_MIME[mime!] ?? "jpg";
  // Decode with Web-standard atob rather than Node's Buffer, so this keeps
  // working unchanged if the app is ever deployed to a runtime (like
  // Cloudflare Workers) without Node's Buffer global.
  const binary = atob(base64!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.byteLength > 8 * 1024 * 1024) {
    throw new Error("Evidence photo is too large (max 8 MB).");
  }

  const path = `evidence/${safeRandomId()}.${ext}`;
  const db = await admin();
  const { error: uploadError } = await db.storage.from(EVIDENCE_BUCKET).upload(path, bytes, {
    contentType: mime!,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  // The evidence bucket is private; photos are served through the
  // /api/evidence/<path> route, which only exposes uploaded evidence files.
  return `/api/evidence/${path}`;
}

const createComplaintSchema = z.object({
  type: z.enum(ISSUE_TYPES),
  description: z.string().min(1).max(2000),
  photo: z.string().max(4_000_000).nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  area: z.string().max(200).optional(),
});

/**
 * Persists a newly reported complaint and returns the saved record,
 * including its permanent database-issued complaint ID.
 */
export const createComplaintFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => createComplaintSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const cls = classifyComplaint(data.type, data.description);
    const createdAt = Date.now();
    const timeline: StatusEvent[] = [
      { status: "Reported", at: createdAt, note: noteFor("Reported") },
      {
        status: "AI Classified",
        at: createdAt,
        note: noteFor("AI Classified", { severity: cls.severity, authority: cls.authority }),
      },
    ];

    // Evidence photos are uploaded to persistent Storage first (not saved
    // as a base64 blob in the row) so the complaint always points at a
    // real, durable file.
    const photoUrl = data.photo ? await uploadEvidencePhoto(data.photo) : null;

    const { data: inserted, error } = await db
      .from("complaints")
      .insert({
        type: data.type,
        description: data.description,
        photo_url: photoUrl,
        lat: data.lat,
        lng: data.lng,
        area: data.area?.trim() || "Pinned location",
        ward: wardFor(data.lat, data.lng),
        status: "AI Classified",
        timeline,
        read: true,
        problem: cls.problem,
        severity: cls.severity,
        authority: cls.authority,
        recommended_action: cls.recommendedAction,
        expected_by: new Date(createdAt + cls.etaHours * 3600_000).toISOString(),
        priority_score: cls.priorityScore,
        priority_reasoning: cls.priorityReasoning,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Real-time authority routing: match the nearest real office for this
    // issue type + location and log the assignment. Failure here must not
    // lose the complaint itself — it just stays unassigned and the next
    // escalation sweep / an admin can assign it manually.
    let row = inserted as Row;
    try {
      const { routeNewComplaint } = await import("./routing.server");
      const { note } = await routeNewComplaint({
        complaintId: row.id,
        issueType: data.type,
        severity: cls.severity,
        lat: data.lat,
        lng: data.lng,
      });
      if (note) {
        const { data: refreshed, error: refetchError } = await db
          .from("complaints")
          .select("*")
          .eq("id", row.id)
          .single();
        if (!refetchError && refreshed) row = refreshed as Row;
      }
    } catch (err) {
      console.error("[routing] failed to route new complaint:", err);
    }

    return rowToComplaint(row);
  });

const mcdStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUSES),
  note: z.string().trim().max(300).optional(),
});

/**
 * Manual MCD status update. This is the shared source of truth for both the
 * MCD console and the citizen complaint page: every change is persisted to
 * the same complaints.status + complaints.timeline fields. No local/demo
 * timeline is generated in the browser.
 */
export const updateMcdComplaintStatusFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => mcdStatusSchema.parse(input))
  .handler(async ({ data }) => {
    const row = await fetchByCode(data.id);
    if (!row) return null;
    const current = rowToComplaint(row);
    if (current.status === data.status && !data.note?.trim()) return current;

    const at = Date.now();
    const note = data.note?.trim() || noteFor(data.status, { authority: "MCD" });
    const timeline: StatusEvent[] = [
      ...current.timeline,
      { status: data.status, at, note },
    ];

    const db = await admin();
    const { data: updated, error } = await db
      .from("complaints")
      .update({ status: data.status, read: false, timeline })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (data.status === "Assigned to Field Team") {
      const { markRoutingDispatched } = await import("./routing.server");
      await markRoutingDispatched(row.id).catch((err) =>
        console.error("[routing] failed to mark dispatch:", err),
      );
    }
    if (data.status === "Resolved") {
      const { markRoutingResolved } = await import("./routing.server");
      await markRoutingResolved(row.id).catch((err) =>
        console.error("[routing] failed to close routing on resolve:", err),
      );
    }

    return rowToComplaint(updated as Row);
  });

/** Advances a complaint to its next lifecycle status. */
export const advanceComplaintFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const row = await fetchByCode(data.id);
    if (!row) return null;
    const current = rowToComplaint(row);
    let i = STATUSES.indexOf(current.status);
    if (i >= STATUSES.length - 1) return current;
    let status = STATUSES[i + 1]!;
    if (status === "Forwarded to Authority") {
      i += 1;
      if (i >= STATUSES.length - 1) return current;
      status = STATUSES[i + 1]!;
    }
    const timeline = [...current.timeline, { status, at: Date.now(), note: noteFor(status) }];
    const db = await admin();
    const { data: updated, error } = await db
      .from("complaints")
      .update({ status, read: false, timeline })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (status === "Assigned to Field Team") {
      const { markRoutingDispatched } = await import("./routing.server");
      await markRoutingDispatched(row.id).catch((err) =>
        console.error("[routing] failed to mark dispatch:", err),
      );
    }
    if (status === "Resolved") {
      const { markRoutingResolved } = await import("./routing.server");
      await markRoutingResolved(row.id).catch((err) =>
        console.error("[routing] failed to close routing on resolve:", err),
      );
    }
    return rowToComplaint(updated as Row);
  });

const handoffSchema = z.object({
  id: z.string().min(1),
  method: z.enum(HANDOFF_METHODS),
});

/**
 * Records that the citizen used one of the real contact actions on the
 * assessment panel (call, email, the authority's own official page, or
 * copying its details) for the complaint's assigned authority. This is
 * purely an activity log — it appends an entry to the routing timeline so
 * the outreach is visible there, but it never changes the complaint's
 * status itself; only recordOfficialReferenceFn does that, once the
 * citizen actually has a reference back from the authority. Safe to call
 * repeatedly (e.g. the citizen calls, then emails).
 */
export const recordHandoffFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => handoffSchema.parse(input))
  .handler(async ({ data }) => {
    const row = await fetchByCode(data.id);
    if (!row) return { ok: false };
    const current = rowToComplaint(row);
    const authorityLabel = current.assignedAuthorityName ?? current.authority;
    const db = await admin();
    const { error } = await db.from("complaint_routing_events").insert({
      complaint_id: row.id,
      event_type: "handoff",
      authority_id: current.assignedAuthorityId,
      authority_name: authorityLabel,
      office_name: current.assignedOffice,
      note: `Citizen ${HANDOFF_LABEL[data.method]} ${authorityLabel}.`,
      actor: "citizen",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const officialReferenceSchema = z.object({
  id: z.string().min(1),
  reference: z.string().trim().min(1).max(200),
});

/**
 * Records the real reference/complaint number the citizen received after
 * actually contacting the assigned authority themselves (by phone, email,
 * or its own portal). Replaces the old forwardComplaintFn, which invented
 * a reference number locally and never involved a real authority. Moves
 * the complaint to "Forwarded to Authority" if it hasn't already passed
 * that stage — a no-op if a reference has already been recorded.
 */
export const recordOfficialReferenceFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => officialReferenceSchema.parse(input))
  .handler(async ({ data }) => {
    const row = await fetchByCode(data.id);
    if (!row) return null;
    const current = rowToComplaint(row);
    if (current.forwardedAt && current.forwardedReference) return current;

    const at = Date.now();
    const authorityLabel = current.assignedAuthorityName ?? current.authority;
    const shouldAdvanceStatus =
      STATUSES.indexOf(current.status) < STATUSES.indexOf("Forwarded to Authority");
    const timeline = [
      ...current.timeline,
      {
        status: "Forwarded to Authority" as Status,
        at,
        note: `Citizen recorded reference ${data.reference} from ${authorityLabel}.`,
      },
    ];
    const db = await admin();
    const { data: updated, error } = await db
      .from("complaints")
      .update({
        ...(shouldAdvanceStatus ? { status: "Forwarded to Authority" } : {}),
        read: false,
        forwarded_at: new Date(at).toISOString(),
        forwarded_reference: data.reference,
        timeline,
      })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const { markRoutingAcknowledged } = await import("./routing.server");
    await markRoutingAcknowledged(row.id).catch((err) =>
      console.error("[routing] failed to mark acknowledgement:", err),
    );
    return rowToComplaint(updated as Row);
  });

export const markReadFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("complaints").update({ read: true }).eq("code", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Citizen confirms that a "Resolved" complaint is actually fixed. Closes
 * the loop on the lifecycle by recording the outcome — a no-op if the
 * complaint isn't Resolved yet, or has already been confirmed.
 */
export const confirmResolutionFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const row = await fetchByCode(data.id);
    if (!row) return null;
    const current = rowToComplaint(row);
    if (current.status !== "Resolved" || current.citizenConfirmedAt) return current;

    const at = Date.now();
    const timeline = [
      ...current.timeline,
      { status: "Resolved" as Status, at, note: CITIZEN_CONFIRMED_NOTE },
    ];
    const db = await admin();
    const { data: updated, error } = await db
      .from("complaints")
      .update({ citizen_confirmed_at: new Date(at).toISOString(), timeline, read: false })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToComplaint(updated as Row);
  });

/** Full routing/escalation timeline for a complaint — assignment,
 * acknowledgement, escalation and admin reassignment events, oldest
 * first. */
export const listRoutingEventsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const row = await fetchByCode(data.id);
    if (!row) return [];
    const { getRoutingEvents } = await import("./routing.server");
    return getRoutingEvents(row.id);
  });

const authoritiesQuerySchema = z.object({
  issueType: z.enum(ISSUE_TYPES).optional(),
});

/** Active authorities that can handle the given issue type — powers the
 * admin override dropdown with real, valid reassignment targets. */
export const listAuthoritiesFn = createServerFn({ method: "GET" })
  .validator((input: unknown) => authoritiesQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { listAuthoritiesFor } = await import("./routing.server");
    return listAuthoritiesFor(data.issueType);
  });

const reassignSchema = z.object({
  id: z.string().min(1),
  authorityId: z.string().min(1),
  note: z.string().max(500).optional(),
});

/** Admin override: manually reassigns a complaint to a specific authority
 * from the directory, bypassing the automatic nearest-office match. */
export const reassignAuthorityFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => reassignSchema.parse(input))
  .handler(async ({ data }) => {
    const row = await fetchByCode(data.id);
    if (!row) throw new Error(`No complaint found for "${data.id}"`);
    const { reassignAuthority } = await import("./routing.server");
    await reassignAuthority({
      complaintId: row.id,
      authorityId: data.authorityId,
      note: data.note,
      actor: "admin",
    });
    const refreshed = await fetchByCode(data.id);
    return refreshed ? rowToComplaint(refreshed) : null;
  });

/**
 * Citizen reports that a "Resolved" complaint is NOT actually fixed —
 * reopens it by sending it back to "Work In Progress" and tracks the
 * reopen count as part of the recorded outcome.
 */
export const reopenComplaintFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const row = await fetchByCode(data.id);
    if (!row) return null;
    const current = rowToComplaint(row);
    if (current.status !== "Resolved") return current;

    const at = Date.now();
    const timeline = [
      ...current.timeline,
      { status: "Work In Progress" as Status, at, note: CITIZEN_REOPENED_NOTE },
    ];
    const db = await admin();
    const { data: updated, error } = await db
      .from("complaints")
      .update({
        status: "Work In Progress",
        citizen_confirmed_at: null,
        reopened_count: current.reopenedCount + 1,
        timeline,
        read: false,
      })
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToComplaint(updated as Row);
  });
