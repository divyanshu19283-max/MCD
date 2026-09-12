import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";
import Shell from "@/components/Shell";
import FilterChips from "@/components/FilterChips";
import ComplaintCard from "@/components/ComplaintCard";
import StatsBar from "@/components/StatsBar";
import { ListSkeleton, StatsBarSkeleton } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";
import { ISSUE_TYPES, getStats, useComplaints } from "@/lib/complaints";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "My Reports — LocalFix" },
      {
        name: "description",
        content: "Every issue you've reported, with live status updates from Reported to Resolved.",
      },
      { property: "og:title", content: "My Reports — LocalFix" },
      {
        property: "og:description",
        content: "Track all your electrical complaints and their current status in one list.",
      },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { list: complaints, loaded, isError, error, refetch } = useComplaints();
  const [type, setType] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");

  const filtered = complaints.filter((c) => {
    const statusMatch =
      status === "All" ||
      (status === "Pending MCD" && !c.forwardedReference) ||
      (status === "Submitted to MCD" && Boolean(c.forwardedReference));
    return (type === "All" || c.type === type) && statusMatch;
  });
  const stats = getStats(complaints);

  return (
    <Shell title="My Reports" subtitle="Filter by issue type or status to find a report.">
      {loaded ? <StatsBar stats={stats} /> : <StatsBarSkeleton />}

      {isError && (
        <div className="panel mt-5 flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold">Could not load report history.</p>
            <p className="mt-1 text-xs text-muted-foreground">{error instanceof Error ? error.message : "Please try again."}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="size-4" aria-hidden="true" /> Retry
          </Button>
        </div>
      )}

      <div className="panel mt-6 space-y-3 p-4">
        <FilterChips
          label="Type"
          options={["All", ...ISSUE_TYPES]}
          value={type}
          onChange={setType}
        />
        <FilterChips
          label="MCD status"
          options={["All", "Pending MCD", "Submitted to MCD"]}
          value={status}
          onChange={setStatus}
        />
      </div>

      <div className="mt-5 space-y-2.5">
        {!loaded && <ListSkeleton label="Loading complaint history…" />}

        {loaded && filtered.length === 0 && (
          <div className="panel flex animate-in fade-in flex-col items-center gap-2 p-12 text-center duration-300">
            <span className="grid size-11 place-items-center rounded-xl bg-secondary/60 text-muted-foreground">
              <Inbox className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-1 text-sm font-semibold text-foreground">
              No complaints match these filters.
            </p>
            <p className="text-xs text-muted-foreground">Try a different issue type or status.</p>
          </div>
        )}

        {loaded &&
          filtered.map((c, i) => (
            <ComplaintCard key={c.id} complaint={c} animationDelayMs={Math.min(i, 8) * 40} />
          ))}
      </div>
    </Shell>
  );
}
