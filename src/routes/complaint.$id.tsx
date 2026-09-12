import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  SearchX,
  ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import Shell from "@/components/Shell";
import MapView from "@/components/MapView";
import Timeline from "@/components/Timeline";
import StatusBadge from "@/components/StatusBadge";
import { TimelineSkeleton } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";
import {
  formatDate,
  markRead,
  type Complaint,
  useComplaint,
} from "@/lib/complaints";

export const Route = createFileRoute("/complaint/$id")({
  head: () => ({
    meta: [
      { title: "Complaint Tracking — LocalFix" },
      {
        name: "description",
        content:
          "View your MCD complaint submission, reference number, location and official MCD contact options.",
      },
      { property: "og:title", content: "Complaint Tracking — LocalFix" },
      {
        property: "og:description",
        content: "Live status timeline and location for your reported electrical fault.",
      },
    ],
  }),
  component: DetailPage,
});

function BackLink() {
  return (
    <Link
      to="/history"
      className="mb-5 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> My Reports
    </Link>
  );
}

/** Shown once a complaint reaches "Resolved" — lets the citizen confirm the
 * fix or reopen the complaint, closing the loop on the lifecycle. */
function DetailPage() {
  const { id } = Route.useParams();
  const { complaint, loaded, refetch } = useComplaint(id);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refetch();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refetch]);

  useEffect(() => {
    if (complaint && !complaint.read) markRead(complaint.id);
  }, [complaint?.id, complaint?.read]);

  if (!loaded) {
    return (
      <Shell title="Loading complaint…">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="panel p-5">
            <TimelineSkeleton label="Loading complaint details…" />
          </div>
          <div className="skeleton h-64 rounded-2xl lg:h-full" />
        </div>
      </Shell>
    );
  }

  if (!complaint) {
    return (
      <Shell title="Complaint not found">
        <div className="panel flex animate-in fade-in flex-col items-center gap-3 p-12 text-center duration-300">
          <span className="grid size-12 place-items-center rounded-xl bg-secondary/60 text-muted-foreground">
            <SearchX className="size-5" aria-hidden="true" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            We couldn't find a complaint with ID{" "}
            <span className="rounded-md bg-secondary/60 px-1.5 py-0.5 font-mono text-xs text-foreground">
              {id}
            </span>
            .
          </p>
          <Link
            to="/history"
            className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to My Reports
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={complaint.type} subtitle={`Complaint ID ${complaint.id} · ${complaint.ward}`}>
      <BackLink />

      <div className="mb-5 panel p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">MCD complaint status</h2>
            <p className="mt-1 text-xs text-muted-foreground">Status shown here comes from the MCD submission result, not a user-controlled simulation.</p>
          </div>
          <StatusBadge status={complaint.status} />
        </div>
        {complaint.forwardedReference ? (
          <div className="mt-3 rounded-xl bg-success/10 p-3 ring-1 ring-success/25">
            <p className="text-xs text-muted-foreground">MCD complaint number</p>
            <p className="mt-1 font-mono text-sm font-semibold">{complaint.forwardedReference}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">MCD has not confirmed a complaint number yet.</p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className="panel p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Report status</h2>
            <StatusBadge status={complaint.status} />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-secondary/25 p-3">
              <p className="text-sm font-semibold">Reported</p>
              <p className="mt-1 text-xs text-muted-foreground">Your report was received by LocalFix.</p>
            </div>
            <div className={complaint.forwardedReference ? "rounded-xl bg-success/10 p-3 ring-1 ring-success/25" : "rounded-xl bg-secondary/25 p-3"}>
              <p className="text-sm font-semibold">{complaint.forwardedReference ? "Submitted to MCD" : "Submitting to MCD"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{complaint.forwardedReference ? `MCD complaint ${complaint.forwardedReference}` : "Waiting for MCD confirmation."}</p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="panel p-4 sm:p-5">
            <h2 className="text-base font-semibold">Details</h2>
            <p className="mt-2 text-sm text-muted-foreground">{complaint.description}</p>
            <div className="mt-4 space-y-2 rounded-xl bg-secondary/25 p-3">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {complaint.area} · {complaint.ward} · reported {formatDate(complaint.createdAt)}
              </p>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Authority: Municipal Corporation of Delhi (MCD)
              </p>
            </div>
            {complaint.photo && (
              <img
                src={complaint.photo}
                alt={`Photo submitted with this ${complaint.type.toLowerCase()} report`}
                className="mt-4 h-52 w-full rounded-xl object-cover ring-1 ring-border"
              />
            )}
          </div>

          <div className="panel border-primary/20 bg-primary/[0.03] p-4 sm:p-5">
            <h2 className="text-base font-semibold">Contact MCD</h2>
            <p className="mt-1 text-xs text-muted-foreground">Use the official MCD contact routes for this complaint.</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <a
                href="tel:+91155305"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
              >
                <Phone className="size-4" aria-hidden="true" />
                Call 155305
              </a>
              <a
                href={`mailto:mcd-ithelpdesk@mcd.nic.in?subject=${encodeURIComponent(`MCD complaint ${complaint.forwardedReference ?? complaint.id}`)}&body=${encodeURIComponent(`Complaint: ${complaint.forwardedReference ?? complaint.id}\nType: ${complaint.type}\nDescription: ${complaint.description}\nLocation: ${complaint.area} · ${complaint.ward}`)}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
              >
                <Mail className="size-4" aria-hidden="true" />
                Email MCD
              </a>
              <a
                href="https://mcdonline.nic.in/portal/mService"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                MCD website
              </a>
            </div>
            <div className="mt-3 rounded-xl bg-secondary/30 p-3 text-xs text-muted-foreground">
              <p><span className="font-semibold text-foreground">Phone:</span> 155305</p>
              <p className="mt-1"><span className="font-semibold text-foreground">Email:</span> mcd-ithelpdesk@mcd.nic.in</p>
            </div>
            {complaint.forwardedReference && (
              <p className="mt-3 rounded-xl bg-success/10 p-3 text-xs ring-1 ring-success/25">
                MCD complaint number: <span className="font-mono font-semibold">{complaint.forwardedReference}</span>
              </p>
            )}
          </div>

          <div className="panel p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">MCD complaint timeline</h2>
                <p className="mt-1 text-xs text-muted-foreground">Live from the shared MCD complaint record. MCD updates appear here automatically.</p>
              </div>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success ring-1 ring-success/20">Live</span>
            </div>
            <Timeline complaint={complaint} />
          </div>

          <div className="panel p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold">Location</h2>
            <MapView
              picked={{ lat: complaint.lat, lng: complaint.lng }}
              className="h-56 w-full sm:h-64"
              zoom={16}
            />
          </div>
        </section>
      </div>
    </Shell>
  );
}
