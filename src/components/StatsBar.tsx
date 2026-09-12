import { AlertCircle, CheckCircle2, Clock, ListChecks } from "lucide-react";
import type { ComplaintStats } from "@/lib/complaints";

const ITEMS = [
  {
    key: "total",
    label: "Total reported",
    icon: ListChecks,
    tone: "text-foreground",
    iconBg: "bg-secondary/70",
  },
  {
    key: "pending",
    label: "Pending MCD",
    icon: AlertCircle,
    tone: "text-muted-foreground",
    iconBg: "bg-secondary/70",
  },
  {
    key: "inProgress",
    label: "Submitted to MCD",
    icon: Clock,
    tone: "text-accent",
    iconBg: "bg-accent/15",
  },
  {
    key: "resolved",
    label: "Resolved by MCD",
    icon: CheckCircle2,
    tone: "text-success",
    iconBg: "bg-success/15",
  },
] as const;

export default function StatsBar({ stats }: { stats: ComplaintStats }) {
  return (
    <div
      className="grid animate-in fade-in grid-cols-2 gap-2 duration-300 sm:grid-cols-4 sm:gap-4"
      aria-label="Complaint summary"
    >
      {ITEMS.map(({ key, label, icon: Icon, tone, iconBg }) => (
        <div key={key} className="panel flex items-center gap-3 p-3 sm:p-4">
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-[12px] ${iconBg} ${tone}`}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold leading-tight">{stats[key]}</p>
            <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
