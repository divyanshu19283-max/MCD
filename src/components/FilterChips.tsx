export default function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={`Filter by ${label.toLowerCase()}`}
    >
      <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 ${
            value === o
              ? "border-primary/50 bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
