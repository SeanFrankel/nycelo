import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNeighborhoods,
  useSubmitCheckin,
  getGetExperienceQueryKey,
} from "@workspace/api-client-react";
import { getVoterToken } from "@/lib/voter";
import { matchNeighborhood } from "@/lib/evidence/geo";
import {
  subscribeAutoCheckin,
  getAutoCheckinState,
  patchAutoCheckinState,
  canCheckin,
  recordCheckinAttempt,
} from "@/lib/autoCheckin";

/** Read-only view of the auto check-in state, usable from any component. */
export function useAutoCheckinState() {
  return useSyncExternalStore(subscribeAutoCheckin, getAutoCheckinState);
}

/**
 * Drives passive check-ins. Mount exactly ONCE (in Layout).
 * While enabled: checks in silently on load, then watches position and
 * checks in again whenever the matched neighborhood changes (or its
 * cooldown expires). Never blocks or surfaces errors in the voting flow.
 */
export function useAutoCheckin(): void {
  const { enabled } = useAutoCheckinState();
  const { data: hoods } = useListNeighborhoods();
  const submitCheckin = useSubmitCheckin();
  const queryClient = useQueryClient();

  // Keep latest deps in refs so the geolocation callbacks never go stale
  // without re-registering the watch.
  const hoodsRef = useRef(hoods);
  hoodsRef.current = hoods;
  const mutateRef = useRef(submitCheckin.mutate);
  mutateRef.current = submitCheckin.mutate;

  // `hoodsReady` is an effect dependency: if the first GPS fix arrives
  // before the neighborhood list has loaded, the effect restarts once the
  // list is ready and re-acquires the (cached) position, so the load-time
  // check-in is never lost.
  const hoodsReady = !!hoods;

  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) {
      patchAutoCheckinState({ status: "unsupported" });
      return;
    }

    let cancelled = false;
    const inFlight = new Set<number>();
    // Short backoff after a failed request so a persistent outage doesn't
    // turn every watchPosition tick into a retry.
    const FAILURE_BACKOFF_MS = 60 * 1000;
    const failedAt = new Map<number, number>();

    const attempt = (lat: number, lng: number) => {
      const allHoods = hoodsRef.current;
      if (cancelled || !allHoods) return;
      const hood = matchNeighborhood(lat, lng, allHoods);
      if (!hood || !canCheckin(hood.id) || inFlight.has(hood.id)) return;
      const lastFail = failedAt.get(hood.id);
      if (lastFail && Date.now() - lastFail < FAILURE_BACKOFF_MS) return;
      inFlight.add(hood.id);
      mutateRef.current(
        { data: { voterToken: getVoterToken(), lat, lng } },
        {
          onSuccess: (res) => {
            inFlight.delete(hood.id);
            failedAt.delete(hood.id);
            // Only a confirmed check-in starts the local cooldown; a
            // transient failure must not lock the neighborhood out.
            recordCheckinAttempt(hood.id);
            if (cancelled) return;
            patchAutoCheckinState({
              lastHoodName: res.neighborhood.name,
              lastCheckinAt: Date.now(),
            });
            queryClient.invalidateQueries({
              queryKey: getGetExperienceQueryKey({
                voterToken: getVoterToken(),
              }),
            });
          },
          onError: (err: unknown) => {
            inFlight.delete(hood.id);
            const status =
              (err as { response?: { status?: number }; status?: number })
                ?.response?.status ??
              (err as { status?: number })?.status;
            if (status === 429) {
              // Server says we're inside its cooldown — mirror it locally.
              recordCheckinAttempt(hood.id);
            } else {
              failedAt.set(hood.id, Date.now());
            }
          },
        },
      );
    };

    const onPosition = (pos: GeolocationPosition) => {
      if (cancelled) return;
      patchAutoCheckinState({ status: "active" });
      attempt(pos.coords.latitude, pos.coords.longitude);
    };

    const onError = (err: GeolocationPositionError) => {
      if (cancelled) return;
      if (err.code === err.PERMISSION_DENIED) {
        patchAutoCheckinState({ status: "denied" });
      } else if (getAutoCheckinState().status !== "active") {
        // Timeout / position-unavailable before a first fix: surface it
        // instead of hanging on "starting". The watch keeps retrying.
        patchAutoCheckinState({ status: "unavailable" });
      }
      // Once active, transient errors don't demote the status; the
      // watch keeps trying on its own.
    };

    patchAutoCheckinState({ status: "starting" });
    navigator.geolocation.getCurrentPosition(onPosition, onError, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 5 * 60 * 1000,
    });
    const watchId = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: false,
      maximumAge: 60 * 1000,
    });

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, hoodsReady, queryClient]);
}
