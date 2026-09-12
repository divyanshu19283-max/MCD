import { useEffect, useState } from "react";

export type GeoState = {
  coords: { lat: number; lng: number } | null;
  status: "idle" | "locating" | "ready" | "denied" | "error";
};

/**
 * Requests the browser's real GPS position once on mount. Never falls back
 * to a hardcoded coordinate — callers get `coords: null` until a real fix
 * comes back (or the user denies/lacks location), and decide for
 * themselves how to handle that (e.g. show a "set your location" prompt).
 */
export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({ coords: null, status: "idle" });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ coords: null, status: "error" });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, status: "locating" }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const { latitude, longitude } = pos.coords;
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 ||
          Math.abs(longitude) > 180
        ) {
          setState({ coords: null, status: "error" });
          return;
        }
        setState({ coords: { lat: latitude, lng: longitude }, status: "ready" });
      },
      (err) => {
        if (cancelled) return;
        setState({
          coords: null,
          status: err.code === err.PERMISSION_DENIED ? "denied" : "error",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
