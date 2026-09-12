import { z } from "zod";
import {
  ISSUE_TYPES,
  STATUSES,
  classifyComplaint,
  distanceKm,
  noteFor,
  wardFor,
  type IssueType,
  type Status,
  type StatusEvent,
} from "./complaint-model";

/**
 * Public REST API layer for complaints/reports.
 *
 * This intentionally speaks a different vocabulary than the internal
 * `complaints` table / `Complaint` app model (see complaint-model.ts and
 * complaints.functions.ts, which power the existing UI via server
 * functions). The REST contract below uses the field names requested for
 * external integrations — id, complaint_id, category, latitude, longitude,
 * address, classification, evidence_url, created_at, updated_at — and this
 * module maps to/from the underlying storage so neither side has to change
 * shape for the other.
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
  updated_at: string;
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
  assigned_authority_id: string | null;
  assigned_authority_name: string | null;
  assigned_office: string | null;
  assigned_contact: string | null;
  routing_distance_km: number | null;
  escalation_level: number;
  routing_status: string;
  routing_sla_deadline: string | null;
  mcd_category_id: number | null;
  mcd_subcategory_id: number | null;
  citizen_id: string | null;
};

export type ApiComplaint = {
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
  assigned_authority: {
    id: string | null;
    name: string | null;
    office: string | null;
    contact: string | null;
    distance_km: number | null;
  };
  escalation_level: number;
  routing_status: string;
  mcd_reference?: string | null;
  mcd_category_id?: number | null;
  mcd_subcategory_id?: number | null;
};

function rowToApi(row: Row): ApiComplaint {
  return {
    id: row.id,
    complaint_id: row.code,
    category: row.type as IssueType,
    description: row.description,
    latitude: row.lat,
    longitude: row.lng,
    address: row.area,
    severity: row.severity,
    classification: row.problem,
    priority_score: row.priority_score,
    priority_reasoning: row.priority_reasoning,
    status: row.status,
    evidence_url: row.photo_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assigned_authority: {
      id: row.assigned_authority_id ?? null,
      name: row.assigned_authority_name ?? null,
      office: row.assigned_office ?? null,
      contact: row.assigned_contact ?? null,
      distance_km: row.routing_distance_km ?? null,
    },
    escalation_level: row.escalation_level ?? 1,
    routing_status: row.routing_status ?? "unassigned",
    mcd_reference: row.forwarded_reference ?? null,
    mcd_category_id: row.mcd_category_id ?? null,
    mcd_subcategory_id: row.mcd_subcategory_id ?? null,
  };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** API-level error carrying an HTTP status code, so route handlers can turn
 * it straight into a JSON error response. */
export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function fetchRowByIdOrCode(idOrCode: string): Promise<Row | null> {
  const db = await admin();
  // Accept either the public complaint_id ("LF-1001") or the internal uuid
  // `id`, so links and API calls both resolve regardless of which one was
  // shared.
  const column = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode)
    ? "id"
    : "code";
  const { data, error } = await db
    .from("complaints")
    .select("*")
    .eq(column, idOrCode)
    .maybeSingle();
  if (error) throw new ApiError(500, error.message);
  return (data as Row | null) ?? null;
}

const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(ISSUE_TYPES).optional(),
  severity: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  citizen_id: z.string().min(16).max(100).optional(),
});

/** GET /api/complaints */
export async function listComplaints(searchParams: URLSearchParams): Promise<{
  data: ApiComplaint[];
  limit: number;
  offset: number;
}> {
  const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) throw new ApiError(400, "Invalid query parameters", parsed.error.flatten());
  const { status, category, severity, limit, offset, citizen_id } = parsed.data;

  const db = await admin();
  let query = db
    .from("complaints")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) query = query.eq("status", status);
  if (category) query = query.eq("type", category);
  if (severity) query = query.eq("severity", severity);
  if (citizen_id) query = query.eq("citizen_id", citizen_id);

  const { data, error } = await query;
  if (error) {
    const message = error.message.includes("citizen_id")
      ? `${error.message} — LocalFix is connected to a Supabase project whose complaints schema is missing citizen_id. Run SUPABASE_FIX_ONCE.sql in the SAME project as SUPABASE_URL, then fully restart the dev server.`
      : error.message;
    throw new ApiError(500, message);
  }
  return { data: ((data ?? []) as Row[]).map(rowToApi), limit, offset };
}

/** GET /api/complaints/:id — id may be either the uuid `id` or the public
 * `complaint_id` code. */
export async function getComplaint(idOrCode: string, citizenId?: string): Promise<ApiComplaint> {
  const row = await fetchRowByIdOrCode(idOrCode);
  if (!row) throw new ApiError(404, `No complaint found for "${idOrCode}"`);
  const isMajor = row.severity === "High" || row.severity === "Critical";
  if (!isMajor && row.citizen_id !== citizenId) {
    throw new ApiError(403, "This report is private to the citizen who submitted it.");
  }
  return rowToApi(row);
}

// Primary shape — the one the Report page submits:
// { type, description, photo, lat, lng, area }
const formShapeSchema = z.object({
  type: z.enum(ISSUE_TYPES),
  description: z.string().min(1).max(2000),
  photo: z.string().max(4_000_000).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  area: z.string().max(200).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  mobile: z.string().min(7).max(20),
  email: z.string().email().max(200),
  mcdCategoryId: z.coerce.number().int().positive(),
  mcdSubcategoryId: z.coerce.number().int().positive(),
  citizenId: z.string().min(16).max(100),
});

// Legacy/external-integration shape, still accepted so existing callers
// don't break.
const externalShapeSchema = z.object({
  category: z.enum(ISSUE_TYPES),
  description: z.string().min(1).max(2000),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(200).optional(),
  evidence_url: z.string().url().max(2000).optional().nullable(),
});

type CreateInput = {
  type: IssueType;
  description: string;
  photo: string | null;
  lat: number;
  lng: number;
  area?: string | undefined;
  firstName: string;
  lastName?: string | undefined;
  mobile: string;
  email: string;
  mcdCategoryId: number;
  mcdSubcategoryId: number;
  citizenId: string;
};

function normalizeCreateBody(body: unknown): CreateInput {
  const form = formShapeSchema.safeParse(body);
  if (form.success) {
    return {
      type: form.data.type,
      description: form.data.description,
      photo: form.data.photo ?? null,
      lat: form.data.lat,
      lng: form.data.lng,
      area: form.data.area,
      firstName: form.data.firstName,
      lastName: form.data.lastName,
      mobile: form.data.mobile,
      email: form.data.email,
      mcdCategoryId: form.data.mcdCategoryId,
      mcdSubcategoryId: form.data.mcdSubcategoryId,
      citizenId: form.data.citizenId,
    };
  }
  const external = externalShapeSchema.safeParse(body);
  if (external.success) {
    return {
      type: external.data.category,
      description: external.data.description,
      photo: external.data.evidence_url ?? null,
      lat: external.data.latitude,
      lng: external.data.longitude,
      area: external.data.address,
      firstName: 'Citizen',
      lastName: '',
      mobile: '',
      email: '',
      mcdCategoryId: 0,
      mcdSubcategoryId: 0,
      citizenId: "external-anonymous",
    };
  }
  throw new ApiError(400, "Invalid complaint payload", form.error.flatten());
}

const EVIDENCE_BUCKET = "complaint-evidence";
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Uploads a base64 data-URL photo (as captured by the report form) to
 * persistent Storage and returns the URL the app serves it from
 * (/api/evidence/<path>, backed by the private evidence bucket). If the
 * photo is already a plain URL it is returned unchanged.
 */
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

export async function uploadEvidencePhoto(photo: string): Promise<string> {
  if (!photo.startsWith("data:")) return photo;
  const match = DATA_URL_PATTERN.exec(photo);
  if (!match) {
    throw new ApiError(400, "Evidence photo must be a JPEG, PNG, WEBP or GIF image.");
  }
  const [, mime, base64] = match;
  const ext = EXT_BY_MIME[mime!] ?? "jpg";
  const binary = atob(base64!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.byteLength > 8 * 1024 * 1024) {
    throw new ApiError(400, "Evidence photo is too large (max 8 MB).");
  }

  const path = `evidence/${safeRandomId()}.${ext}`;
  const db = await admin();
  // Keep the Storage limit aligned with the app's 8 MB client limit.
  // A previous migration used 5 MB, which caused valid 5–8 MB uploads to
  // reach this endpoint and fail with a generic HTTP 500.
  const { data: bucket, error: bucketError } = await db.storage.getBucket(EVIDENCE_BUCKET);
  if (bucketError || !bucket) {
    // A fresh Supabase project may not have run the storage migration yet.
    // Service-role code can safely create the private bucket on first upload.
    const { error: createBucketError } = await db.storage.createBucket(EVIDENCE_BUCKET, {
      public: false,
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: Object.keys(EXT_BY_MIME),
    });
    if (createBucketError) {
      throw new ApiError(
        500,
        `Evidence storage bucket "${EVIDENCE_BUCKET}" is unavailable: ${createBucketError.message}`,
      );
    }
  }

  const { error: uploadError } = await db.storage.from(EVIDENCE_BUCKET).upload(path, bytes, {
    contentType: mime!,
    upsert: false,
  });
  if (uploadError) {
    throw new ApiError(500, `Evidence upload failed: ${uploadError.message}`);
  }

  return `/api/evidence/${path}`;
}

const EVIDENCE_URL_PATTERN =
  /^\/api\/evidence\/(evidence\/[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp|gif))$/i;

/**
 * Deletes a previously uploaded evidence photo from Storage, given the
 * `/api/evidence/<path>` URL this app itself hands out. Used when the
 * user removes or replaces a photo before submitting, so an abandoned
 * upload doesn't linger in the bucket forever. Silently no-ops on a URL
 * that isn't one of ours (e.g. already deleted, or never uploaded here).
 */
export async function deleteEvidencePhoto(url: string): Promise<void> {
  const match = EVIDENCE_URL_PATTERN.exec(url);
  if (!match) return;
  const path = match[1]!;
  const db = await admin();
  await db.storage.from(EVIDENCE_BUCKET).remove([path]);
}

/** POST /api/complaints */
export async function createComplaint(body: unknown): Promise<ApiComplaint> {
  const input = normalizeCreateBody(body);

  const cls = classifyComplaint(input.type, input.description);
  const createdAt = Date.now();
  const timeline: StatusEvent[] = [
    { status: "Reported", at: createdAt, note: "Report received by LocalFix." },
  ];

  // A base64 photo from the form is stored as a durable file in evidence
  // storage; the database row only ever holds its public URL.
  const photoUrl = input.photo ? await uploadEvidencePhoto(input.photo) : null;

  const db = await admin();
  const { data: inserted, error } = await db
    .from("complaints")
    .insert({
      type: input.type,
      description: input.description,
      photo_url: photoUrl,
      lat: input.lat,
      lng: input.lng,
      area: input.area?.trim() || "Pinned location",
      ward: wardFor(input.lat, input.lng),
      status: "Reported",
      timeline,
      read: true,
      problem: cls.problem,
      severity: cls.severity,
      authority: cls.authority,
      recommended_action: cls.recommendedAction,
      expected_by: new Date(createdAt + cls.etaHours * 3600_000).toISOString(),
      priority_score: cls.priorityScore,
      priority_reasoning: cls.priorityReasoning,
      mcd_category_id: input.mcdCategoryId || null,
      mcd_subcategory_id: input.mcdSubcategoryId || null,
      citizen_id: input.citizenId,
    })
    .select("*")
    .single();
  if (error) {
    const message = error.message.includes("citizen_id")
      ? `${error.message} — The connected Supabase project is missing citizen_id. Run SUPABASE_FIX_ONCE.sql in that SAME project and restart the dev server.`
      : error.message;
    throw new ApiError(500, message);
  }

  let row = inserted as Row;

  // Direct MCD 311 submission is server-side only. The MCD credentials never
  // reach the browser. If MCD is configured, submit the same complaint to the
  // official MCD 311 creation endpoint before returning success.
  let mcdSubmitted = false;
  let mcdReference: string | null = null;
  let mcdFailureMessage: string | null = null;
  if (process.env.MCD_DIRECT_SUBMIT === "true") {
    try {
      const { submitComplaintToMcd } = await import("./mcd311.server");
      let image: Blob | null = null;
      let imageName = "evidence.jpg";
      if (photoUrl?.startsWith("/api/evidence/")) {
        const storagePath = photoUrl.slice("/api/evidence/".length);
        const { data: imageBlob } = await db.storage.from(EVIDENCE_BUCKET).download(storagePath);
        if (imageBlob) {
          image = imageBlob;
          imageName = storagePath.split("/").pop() || imageName;
        }
      }

      const mcdResult = await submitComplaintToMcd({
        latitude: input.lat,
        longitude: input.lng,
        title: input.type,
        description: input.description,
        address: input.area?.trim() || "Pinned location",
        firstName: input.firstName,
        lastName: input.lastName,
        mobile: input.mobile,
        email: input.email,
        categoryId: String(input.mcdCategoryId),
        subCategoryId: String(input.mcdSubcategoryId),
        image,
        imageName,
      });
      mcdSubmitted = true;
      if (mcdResult.reference) {
        mcdReference = mcdResult.reference;
        row.forwardedReference = mcdResult.reference;
        row.forwardedAt = Date.now();
      }
    } catch (err) {
      mcdFailureMessage = err instanceof Error ? err.message : "MCD submission failed";
      console.error("[mcd311] direct complaint submission failed; keeping local report:", err);
    }

    const latestRowResult = await db.from("complaints").select("timeline").eq("id", row.id).single();
    const latestTimeline = (Array.isArray(latestRowResult.data?.timeline) ? latestRowResult.data.timeline : timeline) as StatusEvent[];
    const note = mcdSubmitted
      ? { status: "Forwarded to Authority" as Status, at: Date.now(), note: `Submitted directly to MCD 311${mcdReference ? ` · MCD complaint ${mcdReference}` : ""}.` }
      : { status: "Reported" as Status, at: Date.now(), note: `Saved locally. MCD 311 submission failed: ${mcdFailureMessage ?? "unknown error"}.` };
    const dedupedTimeline = [...latestTimeline, note];
    const { data: mcdUpdated } = await db.from("complaints").update({
      timeline: dedupedTimeline,
      ...(mcdSubmitted
        ? {
            status: "Forwarded to Authority",
            forwarded_at: new Date(row.forwardedAt ?? Date.now()).toISOString(),
            forwarded_reference: mcdReference,
          }
        : {}),
    }).eq("id", row.id).select("*").single();
    if (mcdUpdated) row = mcdUpdated as Row;
  }


  // Do not run synthetic/local authority routing. MCD is the authority and its
  // own system is the source of truth for assignment and progress.


  return rowToApi(row);
}

const statusSchema = z.object({ status: z.enum(STATUSES) });

/** PATCH /api/complaints/:id/status */
export async function updateComplaintStatus(
  idOrCode: string,
  body: unknown,
): Promise<ApiComplaint> {
  throw new ApiError(403, "Complaint status is read-only. Status updates come from MCD.");
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "Invalid status payload", parsed.error.flatten());
  const nextStatus: Status = parsed.data.status;

  const row = await fetchRowByIdOrCode(idOrCode);
  if (!row) throw new ApiError(404, `No complaint found for "${idOrCode}"`);

  const currentTimeline = (Array.isArray(row.timeline) ? row.timeline : []) as StatusEvent[];
  const timeline: StatusEvent[] = [
    ...currentTimeline,
    { status: nextStatus, at: Date.now(), note: noteFor(nextStatus, { authority: row.authority }) },
  ];

  const db = await admin();
  const { data: updated, error } = await db
    .from("complaints")
    .update({ status: nextStatus, timeline, read: false })
    .eq("id", row.id)
    .select("*")
    .single();
  if (error) throw new ApiError(500, error.message);
  if (nextStatus === "Forwarded to Authority") {
    const { markRoutingAcknowledged } = await import("./routing.server");
    await markRoutingAcknowledged(row.id).catch(() => {});
  }
  if (nextStatus === "Assigned to Field Team") {
    const { markRoutingDispatched } = await import("./routing.server");
    await markRoutingDispatched(row.id).catch(() => {});
  }
  if (nextStatus === "Resolved") {
    const { markRoutingResolved } = await import("./routing.server");
    await markRoutingResolved(row.id).catch(() => {});
  }
  return rowToApi(updated as Row);
}

const nearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().positive().max(500).default(5),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  citizen_id: z.string().min(16).max(100).optional(),
});

/** GET /api/complaints/nearby?latitude=&longitude=&radius_km=&limit= */
export async function listNearbyComplaints(searchParams: URLSearchParams): Promise<{
  data: (ApiComplaint & { distance_km: number })[];
  center: { latitude: number; longitude: number };
  radius_km: number;
}> {
  const parsed = nearbyQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) throw new ApiError(400, "Invalid query parameters", parsed.error.flatten());
  const { latitude, longitude, radius_km, limit, citizen_id } = parsed.data;

  const db = await admin();
  const { data, error } = await db.from("complaints").select("*");
  if (error) throw new ApiError(500, error.message);

  const withDistance = ((data ?? []) as Row[])
    .filter((row) => row.severity === "High" || row.severity === "Critical")
    .filter((row) => !citizen_id || row.citizen_id !== citizen_id)
    .map((row) => ({ row, distance: distanceKm(row.lat, row.lng, latitude, longitude) }))
    .filter(({ distance }) => distance <= radius_km)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ row, distance }) => ({
      ...rowToApi(row),
      distance_km: Math.round(distance * 1000) / 1000,
    }));

  return { data: withDistance, center: { latitude, longitude }, radius_km };
}

/** GET /api/complaints/:id/routing — the current assignment plus the full
 * routing/escalation timeline for a complaint. */
export async function getComplaintRouting(idOrCode: string): Promise<{
  complaint_id: string;
  assigned_authority: {
    id: string | null;
    name: string | null;
    office: string | null;
    contact: string | null;
    distance_km: number | null;
  };
  escalation_level: number;
  routing_status: string;
  routing_sla_deadline: string | null;
  timeline: unknown[];
}> {
  const row = await fetchRowByIdOrCode(idOrCode);
  if (!row) throw new ApiError(404, `No complaint found for "${idOrCode}"`);
  const { getRoutingEvents } = await import("./routing.server");
  const events = await getRoutingEvents(row.id);
  return {
    complaint_id: row.code,
    assigned_authority: {
      id: row.assigned_authority_id ?? null,
      name: row.assigned_authority_name ?? null,
      office: row.assigned_office ?? null,
      contact: row.assigned_contact ?? null,
      distance_km: row.routing_distance_km ?? null,
    },
    escalation_level: row.escalation_level ?? 1,
    routing_status: row.routing_status ?? "unassigned",
    routing_sla_deadline: row.routing_sla_deadline,
    timeline: events,
  };
}

const reassignBodySchema = z.object({
  authority_id: z.string().min(1),
  note: z.string().max(500).optional(),
  actor: z.string().max(120).optional(),
});

/** POST /api/complaints/:id/routing/reassign — admin override: manually
 * reassigns a complaint to a specific real authority from the directory. */
export async function reassignComplaintAuthority(idOrCode: string, body: unknown) {
  const row = await fetchRowByIdOrCode(idOrCode);
  if (!row) throw new ApiError(404, `No complaint found for "${idOrCode}"`);
  const parsed = reassignBodySchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(400, "Invalid reassignment payload", parsed.error.flatten());

  const { reassignAuthority } = await import("./routing.server");
  try {
    await reassignAuthority({
      complaintId: row.id,
      authorityId: parsed.data.authority_id,
      note: parsed.data.note,
      actor: parsed.data.actor || "admin",
    });
  } catch (err) {
    throw new ApiError(400, err instanceof Error ? err.message : "Reassignment failed");
  }
  return getComplaintRouting(idOrCode);
}

/** POST /api/complaints/escalate-overdue — runs the SLA-escalation sweep
 * on demand. The app also runs this opportunistically on ordinary reads,
 * but for escalation that fires on a strict schedule regardless of
 * traffic, point an external scheduler (cron-job.org, a GitHub Actions
 * cron workflow, or a Supabase scheduled Edge Function) at this endpoint
 * every few minutes. */
export async function escalateOverdueComplaints(): Promise<{
  escalated: number;
  breached: number;
}> {
  const { runEscalationSweep } = await import("./routing.server");
  return runEscalationSweep();
}

const authoritiesQuerySchema = z.object({
  category: z.enum(ISSUE_TYPES).optional(),
});

/** GET /api/authorities — the real authority directory (optionally
 * filtered to those handling a given category), for external integrations
 * and the admin override control. */
export async function listAuthorities(searchParams: URLSearchParams) {
  const parsed = authoritiesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) throw new ApiError(400, "Invalid query parameters", parsed.error.flatten());
  const { listAuthoritiesFor } = await import("./routing.server");
  return listAuthoritiesFor(parsed.data.category);
}


/** Public reports: only major (High/Critical) issues are visible outside the
 * citizen's private My Reports area. PII is never returned by this API. */
export async function listMajorComplaints(searchParams: URLSearchParams): Promise<{
  data: ApiComplaint[];
  limit: number;
  offset: number;
}> {
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 100), 1), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
  const citizenId = searchParams.get("citizen_id") || undefined;
  const db = await admin();
  let query = db
    .from("complaints")
    .select("*")
    .in("severity", ["High", "Critical"])
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (citizenId) query = query.or(`citizen_id.is.null,citizen_id.neq.${citizenId}`);
  const { data, error } = await query;
  if (error) throw new ApiError(500, error.message);
  return { data: ((data ?? []) as Row[]).map(rowToApi), limit, offset };
}
