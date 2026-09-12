import { Check } from "lucide-react";
import { STATUSES, formatDate, type Complaint } from "@/lib/complaints";

export default function Timeline({ complaint }: { complaint: Complaint }) {
  const currentIndex = STATUSES.indexOf(complaint.status);

  return (
    <ol className="mt-5 space-y-5">
      {STATUSES.map((s, i) => {
        const event = complaint.timeline.find((t) => t.status === s);
        const done = i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <li key={s} className="flex gap-3.5" aria-current={isCurrent ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full border transition-colors duration-300 ${
                  done
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-secondary/40 text-muted-foreground"
                } ${isCurrent ? "pulse-soft" : ""}`}
              >
                {done ? (
                  <Check className="check-pop size-4" aria-hidden="true" />
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
              </span>
              {i < STATUSES.length - 1 && (
                <span
                  className={`mt-1 h-9 w-px origin-top ${done ? "line-grow bg-primary" : "bg-border"}`}
                />
              )}
            </div>
            <div className="pt-1">
              <p className={done ? "font-semibold" : "text-muted-foreground"}>{s}</p>
              <p className="text-xs text-muted-foreground">
                {event ? `${event.note} · ${formatDate(event.at)}` : "Pending"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
