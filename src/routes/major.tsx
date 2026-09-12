import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Shell from "@/components/Shell";
import ComplaintCard from "@/components/ComplaintCard";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/Skeletons";
import { useMajorComplaints } from "@/lib/complaints";

export const Route = createFileRoute("/major")({
  head: () => ({ meta: [{ title: "Major Reports — LocalFix" }] }),
  component: MajorReportsPage,
});

function MajorReportsPage() {
  const { list, loaded, isError, error, refetch } = useMajorComplaints();
  return (
    <Shell title="Major Reports" subtitle="High and Critical reports from other citizens are shown here.">
      <div className="panel mb-5 flex items-start gap-3 border-destructive/20 bg-destructive/[0.04] p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Public major-issue feed</p>
          <p className="mt-1 text-xs text-muted-foreground">Ordinary reports stay private. Only High/Critical issues are surfaced here so nearby citizens can see serious hazards.</p>
        </div>
      </div>
      {isError && (
        <div className="panel mb-5 flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load major reports."}</p>
          <Button variant="secondary" size="sm" onClick={() => void refetch()}><RefreshCw className="size-4" /> Retry</Button>
        </div>
      )}
      {!loaded && <ListSkeleton label="Loading major reports…" />}
      {loaded && list.length === 0 && <div className="panel p-10 text-center text-sm text-muted-foreground">No major reports from other citizens yet.</div>}
      <div className="space-y-2.5">
        {loaded && list.map((c, i) => <ComplaintCard key={c.id} complaint={c} animationDelayMs={Math.min(i, 8) * 40} />)}
      </div>
    </Shell>
  );
}
