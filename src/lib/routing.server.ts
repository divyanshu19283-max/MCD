import {
  SEVERITY_RESPONSE_HOURS,
  distanceKm,
  type IssueType,
  type Severity,
} from "./complaint-model";

/**
 * Real-time authority routing engine.
 *
 * Assignment: given a complaint's issue type + location, finds the nearest
 * *active* office (of the correct real authority — MCD zone for civic
 * issues, the correct DISCOM circle for electrical issues) from the
 * `authorities` directory and assigns it.
 *
 * Escalation: every assignment carries an SLA deadline derived from the
 * complaint's severity (the same response-time targets already shown to
 * citizens). If that deadline passes while the complaint is still open,
 * `runEscalationSweep` bumps it to the next level up that office's real
 * escalation chain (zonal/circle office -> that authority's own regional
 * HQ / CGRF -> the Electricity Ombudsman for DISCOM matters), and logs
 * every step to `complaint_routing_events` plus a matching note on the
 * complaint's own citizen-facing timeline.
 */

export type AuthorityRow = {
  id: string;
  name: string;
  authority_type: string;
  office_name: string;
  issue_types: string[];
  level: string;
  escalation_parent_id: string | null;
  lat: number;
  lng: number;
  address: string;
  contact_phone: string;
  contact_email: string | null;
  is_active: boolean;
};

export type RoutingEventRow = {
  id: string;
  complaint_id: string;
  event_type: string;
  authority_id: string | null;
  authority_name: string;
  office_name: string | null;
  distance_km: number | null;
  note: string;
  actor: string;
  created_at: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function contactLabel(a: Pick<AuthorityRow, "contact_phone" | "contact_email">): string {
  return a.contact_email ? `${a.contact_phone} · ${a.contact_email}` : a.contact_phone;
}

/** Finds the nearest active office able to handle `issueType`, from all
 * authorities at the given `level` (defaults to the first-line zonal/circle
 * tier — escalation targets are looked up separately via
 * escalation_parent_id, not by re-running this distance search). */
export async function findNearestAuthority(
  issueType: IssueType,
  lat: number,
  lng: number,
  level: string = "zonal_office",
): Promise<{ authority: AuthorityRow; distanceKm: number } | null> {
  const db = await admin();
  const { data, error } = await db
    .from("authorities")
    .select("*")
    .eq("is_active", true)
    .eq("level", level)
    .contains("issue_types", [issueType]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AuthorityRow[];
  if (rows.length === 0) return null;

  let best: { authority: AuthorityRow; distanceKm: number } | null = null;
  for (const row of rows) {
    const d = distanceKm(lat, lng, row.lat, row.lng);
    if (!best || d < best.distanceKm) best = { authority: row, distanceKm: d };
  }
  return best;
}

function slaDeadline(severity: Severity, from: number = Date.now()): string {
  return new Date(from + SEVERITY_RESPONSE_HOURS[severity] * 3600_000).toISOString();
}

/** Runs once, right after a complaint is inserted: finds the nearest real
 * office for its issue type + location, records the assignment on the
 * complaint row, logs the first `complaint_routing_events` entry, and
 * returns a note to append to the complaint's own citizen-facing timeline
 * so the existing Timeline UI shows the routing outcome inline. */
export async function routeNewComplaint(params: {
  complaintId: string;
  issueType: IssueType;
  severity: Severity;
  lat: number;
  lng: number;
}): Promise<{ note: string | null }> {
  const db = await admin();
  const match = await findNearestAuthority(params.issueType, params.lat, params.lng);
  if (!match) {
    // No office in the directory covers this issue type — leave the
    // complaint unassigned rather than inventing an authority.
    return { note: null };
  }
  const { authority, distanceKm: dist } = match;
  const roundedDist = Math.round(dist * 10) / 10;

  const { error: updateError } = await db
    .from("complaints")
    .update({
      assigned_authority_id: authority.id,
      assigned_authority_name: authority.name,
      assigned_office: authority.office_name,
      assigned_contact: contactLabel(authority),
      routing_distance_km: roundedDist,
      escalation_level: 1,
      routing_status: "assigned",
      routing_sla_deadline: slaDeadline(params.severity),
    })
    .eq("id", params.complaintId);
  if (updateError) throw new Error(updateError.message);

  const note = `Auto-routed to the nearest matching office — ${authority.name} (${authority.office_name}), ${roundedDist} km away.`;

  const { error: eventError } = await db.from("complaint_routing_events").insert({
    complaint_id: params.complaintId,
    event_type: "assigned",
    authority_id: authority.id,
    authority_name: authority.name,
    office_name: authority.office_name,
    distance_km: roundedDist,
    note,
    actor: "system",
  });
  if (eventError) throw new Error(eventError.message);

  return { note };
}

/** Marks routing as resolved once the complaint itself is resolved, so the
 * escalation sweep stops touching it. No-op if the complaint was never
 * routed (no directory match at creation time). */
export async function markRoutingResolved(complaintId: string): Promise<void> {
  const db = await admin();
  await db
    .from("complaints")
    .update({ routing_status: "resolved" })
    .eq("id", complaintId)
    .not("assigned_authority_id", "is", null);
}

type RoutingProgressRow = {
  id: string;
  assigned_authority_id: string | null;
  assigned_authority_name: string | null;
  assigned_office: string | null;
  routing_status: string;
};

async function loadRoutingProgress(complaintId: string): Promise<RoutingProgressRow | null> {
  const db = await admin();
  const { data, error } = await db
    .from("complaints")
    .select("id, assigned_authority_id, assigned_authority_name, assigned_office, routing_status")
    .eq("id", complaintId)
    .single();
  if (error || !data) return null;
  return data as RoutingProgressRow;
}

/** Marks the assigned authority as having acknowledged the complaint —
 * called when the complaint is forwarded to it. No-op if the complaint was
 * never routed, or has already moved past this stage (acknowledged,
 * dispatched or resolved), so it's safe to call more than once. */
export async function markRoutingAcknowledged(complaintId: string): Promise<void> {
  const row = await loadRoutingProgress(complaintId);
  if (!row || !row.assigned_authority_id) return;
  if (row.routing_status !== "assigned" && row.routing_status !== "escalated") return;

  const db = await admin();
  const { error: updateError } = await db
    .from("complaints")
    .update({ routing_status: "acknowledged" })
    .eq("id", complaintId);
  if (updateError) throw new Error(updateError.message);

  const authorityName = row.assigned_authority_name ?? "The assigned authority";
  const note = `${authorityName} acknowledged the complaint.`;
  const { error: eventError } = await db.from("complaint_routing_events").insert({
    complaint_id: complaintId,
    event_type: "acknowledged",
    authority_id: row.assigned_authority_id,
    authority_name: authorityName,
    office_name: row.assigned_office,
    note,
    actor: "system",
  });
  if (eventError) throw new Error(eventError.message);
}

/** Marks the assigned authority as having dispatched a field team — called
 * when the complaint moves to "Assigned to Field Team". No-op if the
 * complaint was never routed, or is already dispatched/resolved. Can fire
 * whether or not the acknowledgement step was recorded, so a status update
 * that skips straight from "assigned" to dispatch still logs correctly. */
export async function markRoutingDispatched(complaintId: string): Promise<void> {
  const row = await loadRoutingProgress(complaintId);
  if (!row || !row.assigned_authority_id) return;
  if (row.routing_status === "dispatched" || row.routing_status === "resolved") return;

  const db = await admin();
  const { error: updateError } = await db
    .from("complaints")
    .update({ routing_status: "dispatched" })
    .eq("id", complaintId);
  if (updateError) throw new Error(updateError.message);

  const authorityName = row.assigned_authority_name ?? "The assigned authority";
  const note = `${authorityName} dispatched a field team.`;
  const { error: eventError } = await db.from("complaint_routing_events").insert({
    complaint_id: complaintId,
    event_type: "dispatched",
    authority_id: row.assigned_authority_id,
    authority_name: authorityName,
    office_name: row.assigned_office,
    note,
    actor: "system",
  });
  if (eventError) throw new Error(eventError.message);
}

type OverdueComplaintRow = {
  id: string;
  code: string;
  type: string;
  severity: string;
  timeline: unknown;
  assigned_authority_id: string;
  escalation_level: number;
};

/** Finds every open, routed complaint whose SLA has expired and escalates
 * each one to its authority's next real escalation tier (zonal/circle
 * office -> that authority's regional HQ/CGRF -> the Electricity
 * Ombudsman). Complaints already at the top of their chain are logged as
 * SLA-breached but not escalated further, since there's no higher real
 * office to hand them to. Safe to call repeatedly — a complaint dropped
 * out of the query the moment its deadline is pushed forward. */
export async function runEscalationSweep(): Promise<{ escalated: number; breached: number }> {
  const db = await admin();
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("complaints")
    .select("id, code, type, severity, timeline, assigned_authority_id, escalation_level")
    .not("assigned_authority_id", "is", null)
    .not("routing_sla_deadline", "is", null)
    .neq("status", "Resolved")
    .neq("routing_status", "resolved")
    .lt("routing_sla_deadline", nowIso);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OverdueComplaintRow[];
  if (rows.length === 0) return { escalated: 0, breached: 0 };

  let escalated = 0;
  let breached = 0;

  for (const row of rows) {
    const { data: current, error: currentError } = await db
      .from("authorities")
      .select("*")
      .eq("id", row.assigned_authority_id)
      .single();
    if (currentError || !current) continue;
    const currentAuthority = current as AuthorityRow;

    if (!currentAuthority.escalation_parent_id) {
      // Already at the top of this authority's real chain — nothing higher
      // to escalate to. Log the breach so it's visible on the timeline,
      // but leave the assignment as-is.
      await db.from("complaint_routing_events").insert({
        complaint_id: row.id,
        event_type: "sla_breached",
        authority_id: currentAuthority.id,
        authority_name: currentAuthority.name,
        office_name: currentAuthority.office_name,
        note: `SLA expired with no response from ${currentAuthority.name}, already at the top of the escalation chain.`,
        actor: "system",
      });
      // Push the deadline forward so this doesn't re-fire every sweep;
      // re-check on the same cadence as the original SLA window.
      await db
        .from("complaints")
        .update({
          routing_sla_deadline: slaDeadline(row.severity as Severity),
        })
        .eq("id", row.id);
      breached += 1;
      continue;
    }

    const { data: parent, error: parentError } = await db
      .from("authorities")
      .select("*")
      .eq("id", currentAuthority.escalation_parent_id)
      .single();
    if (parentError || !parent) continue;
    const parentAuthority = parent as AuthorityRow;

    const nextLevel = row.escalation_level + 1;
    const note = `No response within SLA from ${currentAuthority.name} — automatically escalated to ${parentAuthority.name} (${parentAuthority.office_name}).`;

    const currentTimeline = Array.isArray(row.timeline) ? row.timeline : [];
    const timeline = [
      ...currentTimeline,
      { status: "Forwarded to Authority", at: Date.now(), note },
    ];

    const { error: updateError } = await db
      .from("complaints")
      .update({
        assigned_authority_id: parentAuthority.id,
        assigned_authority_name: parentAuthority.name,
        assigned_office: parentAuthority.office_name,
        assigned_contact: contactLabel(parentAuthority),
        escalation_level: nextLevel,
        routing_status: "escalated",
        routing_sla_deadline: slaDeadline(row.severity as Severity),
        timeline,
        read: false,
      })
      .eq("id", row.id);
    if (updateError) continue;

    await db.from("complaint_routing_events").insert({
      complaint_id: row.id,
      event_type: "escalated",
      authority_id: parentAuthority.id,
      authority_name: parentAuthority.name,
      office_name: parentAuthority.office_name,
      note,
      actor: "system",
    });
    escalated += 1;
  }

  return { escalated, breached };
}

/** Admin override: manually reassigns a complaint to a specific authority,
 * regardless of distance/matching. Used when an automatic match is wrong
 * (e.g. an issue actually straddles two circles). */
export async function reassignAuthority(params: {
  complaintId: string;
  authorityId: string;
  note?: string | undefined;
  actor?: string | undefined;
}): Promise<AuthorityRow> {
  const db = await admin();
  const { data: authority, error: authError } = await db
    .from("authorities")
    .select("*")
    .eq("id", params.authorityId)
    .eq("is_active", true)
    .single();
  if (authError || !authority) throw new Error("Authority not found or inactive.");
  const target = authority as AuthorityRow;

  const { data: complaintRow, error: complaintError } = await db
    .from("complaints")
    .select("id, severity, timeline")
    .eq("id", params.complaintId)
    .single();
  if (complaintError || !complaintRow) throw new Error("Complaint not found.");

  const note =
    params.note?.trim() ||
    `Manually reassigned by admin override to ${target.name} (${target.office_name}).`;

  const currentTimeline = Array.isArray(complaintRow.timeline) ? complaintRow.timeline : [];
  const timeline = [...currentTimeline, { status: "Forwarded to Authority", at: Date.now(), note }];

  const { error: updateError } = await db
    .from("complaints")
    .update({
      assigned_authority_id: target.id,
      assigned_authority_name: target.name,
      assigned_office: target.office_name,
      assigned_contact: contactLabel(target),
      routing_distance_km: null,
      routing_status: "assigned",
      routing_sla_deadline: slaDeadline((complaintRow.severity as Severity) ?? "Medium"),
      timeline,
      read: false,
    })
    .eq("id", params.complaintId);
  if (updateError) throw new Error(updateError.message);

  await db.from("complaint_routing_events").insert({
    complaint_id: params.complaintId,
    event_type: "reassigned",
    authority_id: target.id,
    authority_name: target.name,
    office_name: target.office_name,
    note,
    actor: params.actor?.trim() || "admin",
  });

  return target;
}

/** Full routing timeline for a complaint, oldest first. */
export async function getRoutingEvents(complaintId: string): Promise<RoutingEventRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("complaint_routing_events")
    .select("*")
    .eq("complaint_id", complaintId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RoutingEventRow[];
}

/** Every active authority that can handle `issueType` — powers the admin
 * override dropdown so reassignment is always to a real, valid office. */
export async function listAuthoritiesFor(issueType?: IssueType): Promise<AuthorityRow[]> {
  const db = await admin();
  let query = db.from("authorities").select("*").eq("is_active", true).order("name");
  if (issueType) query = query.contains("issue_types", [issueType]);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AuthorityRow[];
}
