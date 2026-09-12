import { STATUSES, type Status } from "@/lib/complaints";

export default function StatusProgress({ status }: { status: Status }) {
  const index = STATUSES.indexOf(status);
  const pct = ((index + 1) / STATUSES.length) * 100;
  const tone = status === "Resolved" ? "bg-success" : "bg-primary";

  return (
    <div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/70"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={STATUSES.length}
        aria-label={`Status: ${status}`}
      >
        <div
          className={`h-full rounded-full ${tone} transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
        <span>{status}</span>
        <span>
          Step {index + 1} of {STATUSES.length}
        </span>
      </div>
    </div>
  );
}
