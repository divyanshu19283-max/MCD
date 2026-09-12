import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as LeafletNS from "leaflet";
import { DEFAULT_CENTER } from "@/lib/complaints";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  tone: string;
  label: string;
};

type Props = {
  points?: MapPoint[];
  picked?: { lat: number; lng: number } | null;
  onPick?: (coords: { lat: number; lng: number }) => void;
  onPointClick?: (id: string) => void;
  className?: string;
  zoom?: number;
};

const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export default function MapView({
  points = [],
  picked = null,
  onPick,
  onPointClick,
  className = "h-80 w-full",
  zoom = 14,
}: Props) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletNS.Map | null>(null);
  const layer = useRef<LeafletNS.LayerGroup | null>(null);
  const L = useRef<typeof LeafletNS | null>(null);
  const tileLayer = useRef<LeafletNS.TileLayer | null>(null);
  const fallbackTileLayer = useRef<LeafletNS.TileLayer | null>(null);
  const pickRef = useRef(onPick);
  const pointClickRef = useRef(onPointClick);

  pickRef.current = onPick;
  pointClickRef.current = onPointClick;

  useEffect(() => {
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const mod = await import("leaflet");
        if (cancelled || !el.current || map.current) return;

        L.current = mod;
        const m = mod.map(el.current, {
          zoomControl: true,
          attributionControl: true,
          preferCanvas: false,
        });

        const center = picked ? [picked.lat, picked.lng] as [number, number] : DEFAULT_CENTER;
        m.setView(center, zoom);

        // OpenStreetMap is the primary real map source. If the user's
        // network blocks it, automatically switch to a second real tile
        // provider instead of leaving a blank white map.
        const primary = mod
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            subdomains: ["a", "b", "c"],
            maxZoom: 19,
            maxNativeZoom: 19,
            attribution: MAP_ATTRIBUTION,
            crossOrigin: true,
            keepBuffer: 2,
          })
          .addTo(m);

        let fallbackStarted = false;
        const startFallback = () => {
          if (fallbackStarted || cancelled || !map.current) return;
          fallbackStarted = true;
          const fallback = mod
            .tileLayer("https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
              maxZoom: 20,
              attribution:
                '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a> · ' +
                MAP_ATTRIBUTION,
              subdomains: "abcd",
              crossOrigin: true,
              keepBuffer: 2,
            })
            .addTo(m);
          fallbackTileLayer.current = fallback;
          tileLayer.current = primary;
        };

        let tileErrors = 0;
        primary.on("tileerror", () => {
          tileErrors += 1;
          // One failed tile can be transient. If the first few requests fail,
          // switch providers so LAN/demo networks still get a real map.
          if (tileErrors >= 2) startFallback();
        });

        tileLayer.current = primary;
        layer.current = mod.layerGroup().addTo(m);

        m.on("click", (e: LeafletNS.LeafletMouseEvent) => {
          const handler = pickRef.current;
          if (handler) {
            handler({ lat: e.latlng.lat, lng: e.latlng.lng });
          }
        });

        map.current = m;

        resizeTimer = setTimeout(() => {
          if (!cancelled && map.current === m && m.getContainer()?.isConnected) {
            m.invalidateSize(true);
          }
        }, 100);

        draw();
      } catch (err) {
        console.error("Map initialization failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      const current = map.current;
      map.current = null;
      layer.current = null;
      tileLayer.current = null;
      fallbackTileLayer.current = null;
      current?.remove();
    };
    // The map instance is intentionally created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const mod = L.current;
    if (!mod || !layer.current) return;

    layer.current.clearLayers();

    const all: MapPoint[] = [...points];
    if (picked) {
      all.push({
        id: "__picked",
        lat: picked.lat,
        lng: picked.lng,
        tone: "picked",
        label: "Selected location",
      });
    }

    for (const p of all) {
      if (
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lng) ||
        Math.abs(p.lat) > 90 ||
        Math.abs(p.lng) > 180
      ) {
        continue;
      }

      const icon = mod.divIcon({
        className: "map-pin-wrap",
        html: `<span class="map-pin map-pin--${p.tone}"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = mod.marker([p.lat, p.lng], { icon }).addTo(layer.current);
      marker.bindTooltip(p.label, { direction: "top", offset: [0, -10] });

      if (pointClickRef.current && p.id !== "__picked") {
        marker.on("click", () => pointClickRef.current?.(p.id));
      }
    }
  }

  useEffect(() => {
    draw();
  }, [points, picked]);

  useEffect(() => {
    const current = map.current;
    if (!current) return;

    current.invalidateSize(true);

    if (picked) {
      current.setView([picked.lat, picked.lng], Math.max(current.getZoom(), zoom), {
        animate: true,
        duration: 0.5,
      });
    } else {
      current.setView(DEFAULT_CENTER, zoom, { animate: false });
    }
  }, [picked, zoom]);

  return (
    <div
      ref={el}
      className={`overflow-hidden rounded-2xl border border-border shadow-[0_16px_40px_-28px_oklch(0_0_0/0.7)] ${className}`}
      aria-label="Interactive location map"
    />
  );
}
