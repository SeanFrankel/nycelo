import { useEffect, useState } from "react";
import { useListNeighborhoods } from "@workspace/api-client-react";
import { matchNeighborhood } from "@/lib/evidence/geo";

/**
 * The voter's current neighborhood id, matched client-side from
 * geolocation — but ONLY if location permission is already granted
 * (never prompts). Resolves to a number, or null when unknown/denied.
 * `ready` is true once the answer (either way) is known, so callers can
 * wait briefly before firing a personalized request.
 */
export function useCurrentNeighborhoodId(): {
  neighborhoodId: number | null;
  ready: boolean;
} {
  const { data: hoods } = useListNeighborhoods();
  const [neighborhoodId, setNeighborhoodId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hoods) return;
    let cancelled = false;
    const done = (id: number | null) => {
      if (cancelled) return;
      setNeighborhoodId(id);
      setReady(true);
    };

    if (!("geolocation" in navigator) || !navigator.permissions?.query) {
      done(null);
      return;
    }
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (cancelled) return;
        if (status.state !== "granted") {
          done(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const hood = matchNeighborhood(
              pos.coords.latitude,
              pos.coords.longitude,
              hoods,
            );
            done(hood?.id ?? null);
          },
          () => done(null),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
        );
      })
      .catch(() => done(null));

    return () => {
      cancelled = true;
    };
  }, [hoods]);

  return { neighborhoodId, ready };
}
