import { useState } from "react";
import { AlertTriangle, Building2, Clock, Phone, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ROUTING_STATUS_LABEL,
  formatDate,
  reassignAuthority,
  useAuthorities,
  useRoutingEvents,
  type Complaint,
} from "@/lib/complaints";

const ROUTING_STATUS_TONE: Record<string, string> = {
  unassigned: "bg-muted text-muted-foreground",
  assigned: "bg-secondary text-secondary-foreground",
  acknowledged: "bg-primary/15 text-primary",
  dispatched: "bg-primary/15 text-primary",
  escalated: "bg-destructive/15 text-destructive",
  resolved: "bg-success text-success-foreground",
};

const EVENT_ICON: Record<string, typeof Building2> = {
  assigned: Building2,
  reassigned: Wrench,
  escalated: AlertTriangle,
  sla_breached: AlertTriangle,
  acknowledged: ShieldCheck,
  dispatched: Wrench,
  resolved: ShieldCheck,
};

/** Live routing/assignment section for the complaint detail page: which
 * real office this complaint was auto-routed to, how far away it is, its
 * SLA deadline, the full assignment/escalation timeline, and an admin
 * override to manually reassign it. Additive — doesn't change any
 * existing UI on the page. */
export default function RoutingPanel({ complaint }: { complaint: Complaint }) {
  const { events, loaded: eventsLoaded } = useRoutingEvents(complaint.id);
  const [adminOpen, setAdminOpen] = useState(false);

  const status = complaint.routingStatus;
  const overdue =
    complaint.routingSlaDeadline !== null &&
    complaint.routingSlaDeadline < Date.now() &&
    complaint.status !== "Resolved";

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Authority routing &amp; assignment</h2>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${ROUTING_STATUS_TONE[status] ?? ROUTING_STATUS_TONE["unassigned"]}`}
        >
          {ROUTING_STATUS_LABEL[status]}
        </span>
      </div>

      {complaint.assignedAuthorityName ? (
        <div className="mt-4 space-y-2 rounded-xl bg-secondary/25 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {complaint.assignedAuthorityName}
          </p>
          {complaint.assignedOffice && (
            <p className="pl-6 text-xs text-muted-foreground">{complaint.assignedOffice}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-xs text-muted-foreground">
            {complaint.routingDistanceKm !== null && (
              <span>{complaint.routingDistanceKm} km from the reported location</span>
            )}
            {complaint.assignedContact && (
              <span className="flex items-center gap-1">
                <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                {complaint.assignedContact}
              </span>
            )}
            <span>
              Escalation level {complaint.escalationLevel}
              {complaint.escalationLevel > 1 ? " (escalated)" : ""}
            </span>
          </div>
          {complaint.routingSlaDeadline !== null && complaint.status !== "Resolved" && (
            <p
              className={`flex items-center gap-2 pl-6 text-xs ${overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}
            >
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              {overdue ? "SLA passed — due for escalation" : "Response due by"}{" "}
              {formatDate(complaint.routingSlaDeadline)}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-secondary/25 p-3 text-sm text-muted-foreground">
          No matching office was found in the authority directory for this issue type yet. An admin
          can assign one manually below.
        </p>
      )}

      <div className="mt-5">
        <h3 className="text-sm font-semibold">Routing timeline</h3>
        {!eventsLoaded ? (
          <div className="mt-3 space-y-2">
            <div className="skeleton h-10 rounded-lg" />
            <div className="skeleton h-10 rounded-lg" />
          </div>
        ) : events.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No routing activity yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {events.map((event) => {
              const Icon = EVENT_ICON[event.event_type] ?? Building2;
              return (
                <li key={event.id} className="flex gap-2.5 text-xs">
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-foreground">{event.note}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {formatDate(new Date(event.created_at).getTime())}
                      {event.actor !== "system" ? ` · by ${event.actor}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setAdminOpen((v) => !v)}
          className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {adminOpen ? "Hide admin override" : "Admin override: reassign authority"}
        </button>
        {adminOpen && <AdminReassign complaint={complaint} />}
      </div>
    </div>
  );
}

function AdminReassign({ complaint }: { complaint: Complaint }) {
  const { authorities, loaded } = useAuthorities(complaint.type);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function handleReassign() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await reassignAuthority(complaint.id, selected);
      toast.success("Complaint reassigned.");
      setSelected("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reassignment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] text-muted-foreground">
        This is a demo-mode override control — this app has no login system anywhere, so anyone with
        the link can use it, matching the rest of the app's no-auth model.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={selected} onValueChange={setSelected} disabled={!loaded}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Choose a real office to reassign to…" />
          </SelectTrigger>
          <SelectContent>
            {authorities.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} — {a.office_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="secondary"
          disabled={!selected || busy}
          onClick={handleReassign}
          className="sm:w-auto"
        >
          {busy ? "Reassigning…" : "Reassign"}
        </Button>
      </div>
    </div>
  );
}
