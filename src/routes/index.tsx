import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Activity, ArrowRight, CheckCircle2, CircleHelp, Clock, MapPinned, Plus, Radio } from "lucide-react";
import Shell from "@/components/Shell";
import MapView, { type MapPoint } from "@/components/MapView";
import ComplaintCard from "@/components/ComplaintCard";
import { ListSkeleton } from "@/components/Skeletons";
import { ISSUE_TYPES, getStats, useComplaints, type Status } from "@/lib/complaints";
import { ISSUE_ICON } from "@/lib/issue-icons";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — LocalFix" },
      {
        name: "description",
        content:
          "Your civic issue dashboard — report a problem, track nearby faults, and see what's been resolved.",
      },
      { property: "og:title", content: "Dashboard — LocalFix" },
      {
        property: "og:description",
        content: "Report a problem in seconds and keep an eye on what's happening nearby.",
      },
    ],
  }),
  component: DashboardPage,
});

const TONE: Record<Status, string> = {
  Reported: "reported",
  "AI Classified": "classified",
  "Forwarded to Authority": "forwarded",
  "Assigned to Field Team": "assigned",
  "Work In Progress": "progress",
  Resolved: "resolved",
};

const TYPE_ICON = ISSUE_ICON;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const { list: complaints, loaded } = useComplaints();
  const navigate = useNavigate();
  const stats = getStats(complaints);
  const geo = useGeolocation();
  // Real nearby count, straight from the backend's distance-filtered
  // /api/complaints/nearby endpoint against the browser's actual GPS fix —
  // never a hardcoded fallback coordinate. Stays 0 until a real fix lands.
  const [nearby, setNearby] = useState(0);
  useEffect(() => {
    if (geo.status !== "ready" || !geo.coords) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      latitude: String(geo.coords.lat),
      longitude: String(geo.coords.lng),
      radius_km: "1.2",
      limit: "200",
    });
    fetch(`/api/complaints/nearby?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { data: unknown[] } | null) => setNearby(body?.data.length ?? 0))
      .catch(() => {
        // Leave the count as-is; the dashboard isn't the place to surface
        // a location error.
      });
    return () => controller.abort();
  }, [geo.status, geo.coords]);
  const recent = complaints.slice(0, 4);

  const points: MapPoint[] = complaints.slice(0, 30).map((c) => ({
    id: c.id,
    lat: c.lat,
    lng: c.lng,
    tone: TONE[c.status],
    label: `${c.type} · ${c.area} · ${c.status}`,
  }));

  return (
    <Shell title="Dashboard" subtitle="Here's what's happening with civic issues near you.">
      <div className="space-y-6">
        {/* Welcome + primary CTA */}
        <section className="panel relative overflow-hidden p-5 sm:p-7">
          <div
            className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/12 blur-2xl"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <Radio className="pulse-soft size-3 rounded-full text-primary" aria-hidden="true" />
                Live demo data
              </span>
              <h2 className="mt-3 font-display text-xl font-bold tracking-tight sm:text-2xl">
                {greeting()}. Spotted an issue?
              </h2>
              <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                Snap a photo, drop a pin, and get a complaint ID in under a minute.
              </p>
            </div>
            <Link
              to="/report"
              className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-[0_16px_32px_-16px_oklch(0.84_0.18_96/0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_38px_-16px_oklch(0.84_0.18_96/0.75)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Plus
                className="size-5 transition-transform duration-200 group-hover:rotate-90"
                aria-hidden="true"
              />
              Report a Problem
            </Link>
          </div>
        </section>

        {/* Compact stats */}
        <section
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4"
          aria-label="Issue summary"
        >
          <StatCard
            label="Active"
            value={stats.inProgress}
            icon={Activity}
            tone="text-accent"
            iconBg="bg-accent/15"
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon={Clock}
            tone="text-muted-foreground"
            iconBg="bg-secondary/70"
          />
          <StatCard
            label="Resolved"
            value={stats.resolved}
            icon={CheckCircle2}
            tone="text-success"
            iconBg="bg-success/15"
          />
          <StatCard
            label="Nearby"
            value={nearby}
            icon={MapPinned}
            tone="text-primary"
            iconBg="bg-primary/15"
          />
        </section>

        {/* Nearby issues map preview */}
        <section>
          <SectionHeader title="Nearby issues" linkTo="/map" linkLabel="Open full map" />
          <div className="relative mt-3 overflow-hidden rounded-2xl transition-shadow duration-200 hover:shadow-lg">
            <MapView
              points={points}
              className="h-48 w-full sm:h-60"
              zoom={13}
              onPointClick={(id) => navigate({ to: "/complaint/$id", params: { id } })}
            />
            {!loaded && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl border border-border bg-card/85 backdrop-blur-sm">
                <span className="text-xs font-medium text-muted-foreground">Loading map…</span>
              </div>
            )}
          </div>
        </section>

        {/* Recent complaints */}
        <section>
          <SectionHeader title="Recent complaints" linkTo="/history" linkLabel="View all" />
          <div className="mt-3 space-y-2.5">
            {!loaded && <ListSkeleton rows={3} label="Loading recent complaints…" />}
            {loaded &&
              recent.map((c, i) => (
                <ComplaintCard key={c.id} complaint={c} animationDelayMs={i * 40} />
              ))}
          </div>
        </section>

        {/* Quick issue categories */}
        <section>
          <SectionHeader title="Quick report" />
          <div
            className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
            role="group"
            aria-label="Report by issue type"
          >
            {ISSUE_TYPES.map((t) => {
              const Icon = TYPE_ICON[t] ?? CircleHelp;
              return (
                <Link
                  key={t}
                  to="/report"
                  search={{ type: t }}
                  className="panel group flex flex-col items-start gap-3 p-3.5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-secondary/70 text-foreground transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-[17px]" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold leading-tight sm:text-[13px]">{t}</span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function SectionHeader({
  title,
  linkTo,
  linkLabel,
}: {
  title: string;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight sm:text-[17px]">{title}</h2>
      {linkTo && linkLabel && (
        <Link
          to={linkTo}
          className="group inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {linkLabel}
          <ArrowRight
            className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  iconBg,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  tone: string;
  iconBg: string;
}) {
  return (
    <div className="panel group flex items-center gap-3 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-4">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-[12px] transition-transform duration-200 group-hover:scale-105 ${iconBg} ${tone}`}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-bold leading-tight">{value}</p>
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
