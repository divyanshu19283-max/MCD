import { STATUS_TONE, type Status } from "@/lib/complaints";

export default function StatusBadge({
  status,
  className = "",
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide transition-colors duration-300 ${STATUS_TONE[status]} ${className}`}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />
      {status === "Forwarded to Authority" ? "Submitted to MCD" : status}
    </span>
  );
}
