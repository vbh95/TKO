---
name: Unfinished scorer legs
description: Durable ownership and lifecycle rules for a match's unfinished leg.
---

The unfinished leg is server-owned durable state bound to the match scoring version. Client storage and process-local live-scoring caches are presentation aids only and must never recover or authorize a leg.

**Why:** A scorer takeover or application restart previously reset an active leg to 501–501 and could discard the original scorer's visits and statistics.

**How to apply:** Persist every accepted visit before updating the scorer UI or broadcasting it. Hydrate only after lease acquisition, reject stale owners, consume the snapshot during checkout, rotate it transactionally for the next leg, and clear it on authoritative reset or finalization.