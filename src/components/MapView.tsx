"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import type { SavedSpot } from "@/lib/types";

type TravelMode = "WALKING" | "DRIVING" | "TRANSIT";

const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  WALKING: "徒歩",
  DRIVING: "車",
  TRANSIT: "公共交通機関",
};

export default function MapView({ spots }: { spots: SavedSpot[] }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState("");
  const [travelMode, setTravelMode] = useState<TravelMode>("WALKING");
  const [routeSummary, setRouteSummary] = useState<{
    distance: string;
    duration: string;
  } | null>(null);
  const [routeError, setRouteError] = useState("");

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setApiError("NEXT_PUBLIC_GOOGLE_MAPS_API_KEYが設定されていません");
      return;
    }
    if (!mapContainerRef.current) return;

    const loader = new Loader({ apiKey, version: "weekly" });
    loader
      .importLibrary("maps")
      .then(() => {
        if (!mapContainerRef.current) return;
        mapRef.current = new google.maps.Map(mapContainerRef.current, {
          center: { lat: 35.681236, lng: 139.767125 },
          zoom: 12,
        });
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map: mapRef.current,
          suppressMarkers: true,
        });
        setApiReady(true);
      })
      .catch(() => setApiError("Google Mapsの読み込みに失敗しました"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (!apiReady || !mapRef.current) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (spots.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    spots.forEach((spot, index) => {
      const marker = new google.maps.Marker({
        position: { lat: spot.lat, lng: spot.lng },
        map: mapRef.current!,
        label: `${index + 1}`,
        title: spot.spotName,
      });
      markersRef.current.push(marker);
      bounds.extend(marker.getPosition()!);
    });
    mapRef.current.fitBounds(bounds);
    if (spots.length === 1) {
      mapRef.current.setZoom(15);
    }
  }, [apiReady, spots]);

  function showRoute() {
    if (!apiReady || spots.length < 2 || !directionsRendererRef.current) return;
    setRouteError("");

    const directionsService = new google.maps.DirectionsService();
    const [origin, ...rest] = spots;
    const destination = rest[rest.length - 1];
    const waypoints = rest.slice(0, -1).map((spot) => ({
      location: { lat: spot.lat, lng: spot.lng },
      stopover: true,
    }));

    directionsService.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        waypoints,
        travelMode: google.maps.TravelMode[travelMode],
      },
      (result, status) => {
        if (status === "OK" && result) {
          directionsRendererRef.current!.setDirections(result);
          const legs = result.routes[0]?.legs ?? [];
          const totalDistanceMeters = legs.reduce(
            (sum, leg) => sum + (leg.distance?.value ?? 0),
            0,
          );
          const totalDurationSeconds = legs.reduce(
            (sum, leg) => sum + (leg.duration?.value ?? 0),
            0,
          );
          setRouteSummary({
            distance: `${(totalDistanceMeters / 1000).toFixed(1)} km`,
            duration: `${Math.round(totalDurationSeconds / 60)} 分`,
          });
        } else {
          setRouteError("ルートを取得できませんでした");
          setRouteSummary(null);
        }
      },
    );
  }

  if (apiError) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-orange-50 text-sm text-stone-500">
        {apiError}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div ref={mapContainerRef} className="h-80 w-full rounded-2xl border border-orange-100 sm:h-96" />

      {spots.length >= 2 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-100 bg-white p-3">
          <div className="flex gap-1">
            {(Object.keys(TRAVEL_MODE_LABELS) as TravelMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setTravelMode(mode)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  travelMode === mode
                    ? "bg-brand-600 text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {TRAVEL_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          <button
            onClick={showRoute}
            className="rounded-full bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            ルートを表示
          </button>
          {routeSummary && (
            <span className="text-sm text-stone-600">
              合計 {routeSummary.distance} ・ 約{routeSummary.duration}
            </span>
          )}
          {routeError && <span className="text-sm text-red-500">{routeError}</span>}
        </div>
      )}
    </div>
  );
}
