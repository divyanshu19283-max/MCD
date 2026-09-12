export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <span
      className={`relative grid ${className} shrink-0 place-items-center rounded-[12px] bg-foreground text-primary shadow-sm`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-[58%]" fill="none">
        <path
          d="M13.2 2.5 5.6 13.1a.7.7 0 0 0 .57 1.1h4.02l-1.4 7.3a.7.7 0 0 0 1.26.53l7.6-10.6a.7.7 0 0 0-.57-1.1h-4.02l1.4-7.3a.7.7 0 0 0-1.26-.53Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

export function Wordmark({
  size = "text-base",
  markClass = "size-9",
}: {
  size?: string;
  markClass?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <LogoMark className={markClass} />
      <span className="flex min-w-0 flex-col leading-none">
        <span className={`font-display ${size} font-bold tracking-tight`}>LocalFix</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Civic reports
        </span>
      </span>
    </span>
  );
}
