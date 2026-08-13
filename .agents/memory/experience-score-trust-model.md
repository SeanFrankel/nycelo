---
name: Experience Score trust model
description: Why NYCELO vote-weight evidence is self-attested and how abuse is bounded
---

Evidence for the NYC Experience Score is **self-attested by design**: location files (Timeline JSON, GPX, KML/KMZ, photo EXIF) are parsed entirely in the browser and only per-neighborhood aggregates reach the server. Raw files never leaving the device is a user-stated privacy requirement, and there are no accounts — so the server cannot cryptographically verify aggregates or check-ins.

**Why:** User explicitly required seamless, anonymous, privacy-first UX; a code review flagged forgeability, and the accepted mitigation (not a rebuild) was to bound damage instead of prove evidence.

**How to apply:** Keep the bounds intact when touching these endpoints: weight ceiling 2.0x / floor 0.25x on K-factor; sanity caps + `greatest()` idempotent merge on POST /experience; in-memory rate limits per token and IP; 30-min per-voter-per-neighborhood check-in cooldown. Do not add features that let raw aggregates scale vote weight beyond the ceiling, and don't "fix" forgeability by uploading raw location data.
