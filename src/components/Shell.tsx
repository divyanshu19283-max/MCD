import { Link, useLocation } from "@tanstack/react-router";
import { AlertTriangle, Bell, FileText, History as HistoryIcon, Home, MapPinned } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useComplaints } from "@/lib/complaints";
import { LogoMark, Wordmark } from "@/components/Logo";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/report", label: "Report", icon: FileText },
  { to: "/history", label: "My Reports", icon: HistoryIcon },
  { to: "/major", label: "Major Reports", icon: AlertTriangle },
  { to: "/map", label: "Nearby", icon: MapPinned },
] as const;

/** Render the viewer-dependent date only after hydration so SSR and client
 * markup are identical. */
function TodayLabel() {
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      }),
    );
  }, []);

  return (
    <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
      {today ?? ""}
    </span>
  );
}

function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      to="/history"
      className="relative grid size-9 shrink-0 place-items-center rounded-[12px] border border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={unread > 0 ? `Status updates, ${unread} unread` : "Status updates"}
    >
      <Bell className="size-[17px]" />
      {unread > 0 && (
        <span
          className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
          aria-hidden="true"
        >
          {unread}
        </span>
      )}
    </Link>
  );
}

function DemoBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-secondary/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      title="Reports are saved in the LocalFix database."
    >
      <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      Live reports
    </span>
  );
}

export default function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { list: complaints } = useComplaints();
  const unread = complaints.filter((c) => !c.read).length;
  const location = useLocation();
  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[999] focus:rounded-[12px] focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Compact desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[224px] shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
        <Link
          to="/"
          className="flex items-center px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Wordmark markClass="size-9" />
        </Link>

        <nav className="flex flex-1 flex-col gap-1 px-3 pt-2" aria-label="Primary">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                <span className="truncate">{n.label}</span>
                {active && (
                  <span className="ml-auto h-4 w-1 rounded-full bg-primary" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <DemoBadge />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        {/* Refined top header */}
        <header className="glass sticky top-0 z-[500] border-b border-border">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
            <Link to="/" className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <LogoMark className="size-8" />
              <span className="truncate font-display text-base font-bold tracking-tight">
                LocalFix
              </span>
            </Link>

            <p className="hidden min-w-0 truncate text-sm font-semibold text-foreground lg:block">
              {title}
            </p>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <TodayLabel />
              <span className="lg:hidden">
                <DemoBadge />
              </span>
              <NotificationBell unread={unread} />
            </div>
          </div>
        </header>

        <main
          id="main-content"
          key={location.pathname}
          className="mx-auto w-full max-w-5xl flex-1 animate-in fade-in px-4 py-6 duration-200 sm:px-6 sm:py-8"
        >
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.625rem]">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>

      {/* Floating mobile bottom nav */}
      <nav
        className="fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[500] lg:hidden"
        aria-label="Primary"
      >
        <div className="flex items-stretch gap-1 rounded-[16px] border border-border bg-card/95 p-1.5 shadow-[0_10px_30px_-10px_oklch(0_0_0/0.28)] backdrop-blur-xl">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-1 flex-col items-center gap-1 rounded-[12px] py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? "bg-secondary text-foreground" : "text-muted-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
