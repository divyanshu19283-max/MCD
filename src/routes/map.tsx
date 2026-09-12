import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crosshair, Loader2, LocateFixed } from "lucide-react";
import Shell from "@/components/Shell";
import MapView, { type MapPoint } from "@/components/MapView";
import LocationSearch from "@/components/LocationSearch";
import FilterChips from "@/components/FilterChips";
import { Button } from "@/components/ui/button";
import { ISSUE_TYPES, STATUSES, type Status } from "@/lib/complaints";
import { useGeolocation } from "@/hooks/use-geolocation";
import { getCitizenId } from "@/lib/citizen-identity";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Nearby Reported Problems — LocalFix" },
      {
        name: "description",
        content: "See streetlight, outage, pole and wire faults reported around you on a live map.",
      },
      { property: "og:title", content: "Nearby Reported Problems — LocalFix" },
      {
        property: "og:description",
        content: "A live map of electrical faults reported in your neighbourhood.",
      },
    ],
  }),
  component: MapPage,
});

const TONE: Record<Status, string> = {
  Reported: "reported",
  "AI Classified": "classified",
  "Forwarded to Authority": "forwarded",
  "Assigned to Field Team": "assigned",
  "Work In Progress": "progress",
  Resolved: "resolved",
};

/** Shape of one item returned by GET /api/complaints/nearby. */
type NearbyComplaint = {
  complaint_id: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  status: string;
  distance_km: number;
};

function MapPage() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [centerLabel, setCenterLabel] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [reports, setReports] = useState<NearbyComplaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once the browser gives a real GPS fix, use it as the default center —
  // never a hardcoded coordinate. The user can still override via search
  // or "Use my location" below.
  useEffect(() => {
    if (geo.status === "ready" && geo.coords && !center) {
      setCenter(geo.coords);
      setCenterLabel("Your current location");
    }
  }, [geo.status, geo.coords, center]);

  // Fetch real nearby reports from the backend whenever the center or
  // radius changes.
  useEffect(() => {
    if (!center) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      latitude: String(center.lat),
      longitude: String(center.lng),
      radius_km: String(radiusKm),
      limit: "100",
      citizen_id: getCitizenId(),
    });
    fetch(`/api/complaints/nearby?${params.toString()}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((body: { data: NearbyComplaint[] }) => setReports(body.data ?? []))
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Couldn't load nearby reports.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [center, radiusKm]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCenterLabel("Your current location");
      },
      () => setError("Couldn't get your location — try searching for a place instead."),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const points: MapPoint[] = reports
    .filter(
      (c) => (type === "All" || c.category === type) && (status === "All" || c.status === status),
    )
    .map((c) => ({
      id: c.complaint_id,
      lat: c.latitude,
      lng: c.longitude,
      tone: TONE[c.status as Status] ?? "reported",
      label: `${c.category} · ${c.address} · ${c.distance_km.toFixed(2)} km away`,
    }));

  return (
    <Shell title="Nearby problems" subtitle="Reports near a location, straight from the database.">
      <div className="panel space-y-3 p-4">
        <LocationSearch
          placeholder="Search a place to see reports near it…"
          onSelect={({ lat, lng, label }) => {
            setCenter({ lat, lng });
            setCenterLabel(label);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={useMyLocation}>
            {geo.status === "locating" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Crosshair className="size-4" aria-hidden="true" />
            )}
            Use my location
          </Button>
          <FilterChips
            label="Radius"
            options={["1", "2", "5", "10", "25"].map((k) => `${k} km`)}
            value={`${radiusKm} km`}
            onChange={(v) => setRadiusKm(Number.parseFloat(v))}
          />
        </div>
        <FilterChips
          label="Type"
          options={["All", ...ISSUE_TYPES]}
          value={type}
          onChange={setType}
        />
        <FilterChips
          label="Status"
          options={["All", ...STATUSES]}
          value={status}
          onChange={setStatus}
        />
        {centerLabel && (
          <p className="text-xs text-muted-foreground">
            Centered on: <span className="font-medium text-foreground">{centerLabel}</span>
          </p>
        )}
      </div>

      <div className="relative mt-5 animate-in fade-in duration-300">
        <MapView
          points={points}
          picked={center}
          className="h-[24rem] w-full sm:h-[32rem]"
          zoom={13}
          onPointClick={(id) => navigate({ to: "/complaint/$id", params: { id } })}
        />
        {!center && (
          <div
            className="absolute inset-0 grid place-items-center rounded-2xl border border-border bg-card/85 backdrop-blur-sm"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
              <LocateFixed className="size-5 animate-pulse" aria-hidden="true" />
              {geo.status === "denied"
                ? "Location permission denied — search for a place above."
                : geo.status === "error"
                  ? "Couldn't get your location — search for a place above."
                  : "Getting your location…"}
            </div>
          </div>
        )}
        {center && loading && (
          <div className="absolute inset-x-0 top-3 flex justify-center">
            <span className="animate-in fade-in flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-lg">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Loading nearby
              reports…
            </span>
          </div>
        )}
        {center && !loading && error && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="animate-in fade-in rounded-full border border-destructive/40 bg-card px-3.5 py-1.5 text-xs font-medium text-destructive shadow-lg">
              {error}
            </span>
          </div>
        )}
        {center && !loading && !error && points.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
            <span className="animate-in fade-in rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-lg">
              No reports match within {radiusKm} km
            </span>
          </div>
        )}
      </div>

      <div className="panel mt-4 flex flex-wrap items-center gap-4 p-3.5 text-xs text-muted-foreground">
        {STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-2">
            <span className={`map-pin map-pin--${TONE[s]} !size-3`} aria-hidden="true" /> {s}
          </span>
        ))}
        <span className="ml-auto font-semibold text-foreground" aria-live="polite">
          {points.length} shown
        </span>
      </div>
    </Shell>
  );
}
