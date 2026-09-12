import { useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Gauge,
  Hash,
  Landmark,
  Loader2,
  Mail,
  Phone,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import {
  DEPARTMENT_BY_TYPE,
  SEVERITY_TONE,
  formatDate,
  officialPageFor,
  parseAssignedContact,
  priorityTierFor,
  recordHandoff,
  recordOfficialReference,
  type Complaint,
  type HandoffMethod,
} from "@/lib/complaints";

/**
 * Plain-text report summary for the two places a citizen needs to hand
 * this complaint's details to a human without retyping them: the
 * pre-filled email body, and the "Copy details" action (for pasting into
 * a phone call's notes, a WhatsApp chat, or a portal's own form field).
 * Kept deliberately plain — no markup — since it has to survive being
 * pasted into an email client, SMS, or a government web form alike.
 */
function buildReportSummary(complaint: Complaint): string {
  const trackingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/complaint/${complaint.id}`
      : `/complaint/${complaint.id}`;
  return [
    `LocalFix complaint ${complaint.id}`,
    `Issue: ${complaint.type} — ${complaint.problem}`,
    `Severity: ${complaint.severity}`,
    `Location: ${complaint.area}`,
    `Description: ${complaint.description}`,
    `Reported: ${formatDate(complaint.createdAt)}`,
    `Track this report: ${trackingUrl}`,
  ].join("\n");
}

/** Row shown for each classified field — icon, label, value. */
function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary/60 text-primary">
        <Icon className="size-4" aria-hidden={true} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

export default function AssessmentPanel({ complaint }: { complaint: Complaint }) {
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState(false);
  const confirmed = Boolean(complaint.forwardedAt && complaint.forwardedReference);

  const authorityLabel = complaint.assignedAuthorityName ?? complaint.authority;
  const officeLabel = complaint.assignedOffice;
  const assignedContact = parseAssignedContact(complaint.assignedContact);
  const phone = assignedContact.phone;
  const email = assignedContact.email;
  const officialPage = officialPageFor(complaint.assignedAuthorityName);
  const isMcd = Boolean(
    complaint.assignedAuthorityName?.startsWith("MCD ") ||
      complaint.authority.toLowerCase().includes("municipal corporation"),
  );
  const mcdPhone = isMcd ? "155305" : null;
  const mcdEmail = isMcd ? "mcd-ithelpdesk@mcd.nic.in" : null;
  const contactPhone = phone ?? mcdPhone;
  const contactEmail = email ?? mcdEmail;
  const contactPage = officialPage ?? (isMcd ? "https://mcdonline.nic.in/portal/" : null);
  const hasAnyContactAction = Boolean(contactPhone || contactEmail || contactPage);

  const mailtoHref = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(`Complaint ${complaint.id} — ${complaint.type}`)}&body=${encodeURIComponent(buildReportSummary(complaint))}`
    : null;

  /** Fire-and-forget activity log — never blocks the tel:/mailto:/external
   * link it's attached to, and a failure here shouldn't stop the citizen
   * from actually reaching the authority. */
  function logHandoff(method: HandoffMethod) {
    void recordHandoff(complaint.id, method).catch((err) => {
      console.error("Failed to record handoff:", err);
    });
  }

  async function handleCopy() {
    const details = [
      `${authorityLabel}${officeLabel ? ` — ${officeLabel}` : ""}`,
      contactPhone ? `Phone: ${contactPhone}` : null,
      contactEmail ? `Email: ${contactEmail}` : null,
      "",
      buildReportSummary(complaint),
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      toast.success("Contact details and report copied");
      logHandoff("copy");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — your browser may be blocking clipboard access.");
    }
  }

  async function handleReferenceSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = reference.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const updated = await recordOfficialReference(complaint.id, trimmed);
      if (updated?.forwardedReference) {
        toast.success(`Confirmed with ${authorityLabel}`, {
          description: `Reference ${updated.forwardedReference} · ${formatDate(updated.forwardedAt!)}`,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that reference.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel animate-in fade-in p-4 duration-300 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Automatic assessment</h2>
        <SeverityBadge severity={complaint.severity} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Generated instantly from your report — no need to wait for a human review.
      </p>

      <div className="mt-2 divide-y divide-border">
        <Row icon={AlertTriangle} label="Problem detected">
          {complaint.problem}
        </Row>
        <Row icon={Gauge} label="Priority / impact score">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold">{complaint.priorityScore}/100</span>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${SEVERITY_TONE[priorityTierFor(complaint.priorityScore)]}`}
            >
              {priorityTierFor(complaint.priorityScore)} priority
            </span>
          </div>
        </Row>
        <Row icon={Landmark} label="Responsible authority">
          {complaint.authority}
        </Row>
        <Row icon={Building2} label="Department / team">
          {DEPARTMENT_BY_TYPE[complaint.type]}
        </Row>
        <Row icon={Wrench} label="Recommended action">
          {complaint.recommendedAction}
        </Row>
        <Row icon={Hash} label="Complaint ID">
          <span className="font-mono">{complaint.id}</span>
        </Row>
        <Row icon={Clock} label="Current status">
          <StatusBadge status={complaint.status} />
        </Row>
        <Row icon={Clock} label="Expected response by">
          {formatDate(complaint.expectedBy)}
        </Row>
      </div>

      <div className="mt-3 rounded-xl bg-secondary/40 p-3 ring-1 ring-border">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
          Why this score
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{complaint.priorityReasoning}</p>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        {confirmed ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-success/10 p-3 ring-1 ring-success/25">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">Confirmed with {authorityLabel}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Reference <span className="font-mono">{complaint.forwardedReference}</span> ·{" "}
                {formatDate(complaint.forwardedAt!)}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
              Contact {authorityLabel}
            </p>
            {officeLabel && <p className="mt-0.5 text-xs text-muted-foreground">{officeLabel}</p>}
            <p className="mt-1.5 text-xs text-muted-foreground">
              {isMcd
                ? "Your report is sent to MCD 311 when direct submission is available. You can also call MCD or open a pre-filled email below."
                : "Use a real action below — your report details are pre-filled so you do not have to retype them."}
            </p>

            {hasAnyContactAction ? (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {contactPhone && (
                  <Button asChild variant="secondary" onClick={() => logHandoff("call")}>
                    <a href={`tel:${contactPhone}`}>
                      <Phone className="size-4" aria-hidden="true" /> Call
                    </a>
                  </Button>
                )}
                {mailtoHref && (
                  <Button asChild variant="secondary" onClick={() => logHandoff("email")}>
                    <a href={mailtoHref}>
                      <Mail className="size-4" aria-hidden="true" /> Email
                    </a>
                  </Button>
                )}
                {contactPage && (
                  <Button asChild variant="secondary" onClick={() => logHandoff("website")}>
                    <a href={contactPage} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" aria-hidden="true" /> Official page
                    </a>
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="size-4" aria-hidden="true" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" aria-hidden="true" /> Copy details
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <p className="mt-2 rounded-xl bg-secondary/25 p-3 text-xs text-muted-foreground">
                No specific office has been matched to this report yet — check back once it's
                routed.
              </p>
            )}

            <form onSubmit={handleReferenceSubmit} className="mt-4 border-t border-border pt-3">
              <label
                htmlFor={`reference-${complaint.id}`}
                className="text-[11px] font-semibold uppercase tracking-wide text-foreground"
              >
                Got a reference number from them?
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Enter it once you've actually contacted {authorityLabel} to mark this complaint as
                forwarded.
              </p>
              <div className="mt-2 flex gap-2">
                <Input
                  id={`reference-${complaint.id}`}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. MCD/2026/44821"
                  disabled={submitting}
                  className="flex-1"
                />
                <Button type="submit" disabled={!reference.trim() || submitting}>
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
