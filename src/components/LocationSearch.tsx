import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LocationResult = {
  lat: number;
  lng: number;
  label: string;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type Props = {
  onSelect: (result: LocationResult) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Free-text place search. Queries the real OpenStreetMap Nominatim search
 * API (no API key required, same provider already used for reverse
 * geocoding elsewhere in the app) and lets the user pick a real result —
 * never a hardcoded/fake coordinate.
 */
export default function LocationSearch({ onSelect, placeholder, className }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      )
        .then((r) => (r.ok ? r.json() : []))
        .then((data: NominatimResult[]) => {
          setResults(Array.isArray(data) ? data : []);
          setOpen(true);
        })
        .catch(() => {
          if (!controller.signal.aborted) setResults([]);
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(r: NominatimResult) {
    const lat = Number.parseFloat(r.lat);
    const lng = Number.parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    onSelect({ lat, lng, label: r.display_name });
    setQuery(r.display_name);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/25 px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Search for an address or place…"}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label="Search for a location"
        />
        {loading && (
          <Loader2
            className="size-4 shrink-0 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-[500] mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-secondary/60"
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 break-words text-xs text-foreground">
                  {r.display_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
