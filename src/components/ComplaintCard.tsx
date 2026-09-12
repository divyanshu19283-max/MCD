import { Link } from "@tanstack/react-router";
import { Calendar, ChevronRight, CircleHelp, Mail, MapPin, Phone } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import SeverityBadge from "@/components/SeverityBadge";
import { Button } from "@/components/ui/button";
import { formatDate, type Complaint } from "@/lib/complaints";
import { ISSUE_ICON } from "@/lib/issue-icons";

export default function ComplaintCard({
  complaint,
  animationDelayMs = 0,
}: {
  complaint: Complaint;
  animationDelayMs?: number;
}) {
  const Icon = ISSUE_ICON[complaint.type] ?? CircleHelp;

  return (
    <div
      style={{ animationDelay: `${animationDelayMs}ms`, animationFillMode: "both" }}
      className="panel group animate-in fade-in p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md sm:p-4"
    >
      <div className="flex items-start gap-3">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-[12px] bg-secondary/70 text-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="size-[18px]" aria-hidden="true" />
          {!complaint.read && (
            <span
              className="absolute -right-1 -top-1 size-2.5 rounded-full bg-primary ring-2 ring-card"
              aria-hidden="true"
            />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold sm:text-[15px]">
                {complaint.type}
              </span>
              <span className="shrink-0 rounded-md bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {complaint.id}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <SeverityBadge severity={complaint.severity} />
              <StatusBadge status={complaint.status} />
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {complaint.area} · {complaint.ward}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1">
              <Calendar className="size-3" aria-hidden="true" />
              {formatDate(complaint.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border bg-secondary/20 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-xs font-semibold text-foreground">Contact MCD</span>
          <a
            href="tel:+91155305"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
            aria-label="Call MCD at 155305"
          >
            <Phone className="size-3.5" aria-hidden="true" />
            Call 155305
          </a>
          <a
            href={`mailto:mcd-ithelpdesk@mcd.nic.in?subject=${encodeURIComponent(`MCD complaint ${complaint.forwardedReference ?? complaint.id}`)}&body=${encodeURIComponent(`Complaint: ${complaint.forwardedReference ?? complaint.id}\nType: ${complaint.type}\nDescription: ${complaint.description}`)}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
            aria-label="Email MCD at mcd-ithelpdesk at mcd dot nic dot in"
          >
            <Mail className="size-3.5" aria-hidden="true" />
            Email MCD
          </a>
          <a
            href="https://mcdonline.nic.in/portal/mService"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
            aria-label="Open MCD online services"
          >
            MCD website
          </a>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Phone and email open your device's configured calling and mail apps. The website opens MCD Online Services directly.</p>
      </div>

      <div className="mt-3 flex justify-end">
        <Button asChild variant="outline" size="sm" className="group/btn">
          <Link to="/complaint/$id" params={{ id: complaint.id }}>
            View Details
            <ChevronRight
              className="size-3.5 transition-transform duration-150 group-hover/btn:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </Button>
      </div>
    </div>
  );
}
