---
name: Unfinished scorer legs
description: Durable ownership and lifecycle rules for a match's unfinished leg.
---

The unfinished leg is server-owned durable state bound to the match scoring version. Client storage and process-local live-scoring caches are presentation aids only and must never recover or authorize a leg. A valid, unexpired board session and the current board assignment authorize scoring; an exclusive per-match scorer lease does not.

**Why:** A scorer takeover or application restart previously reset an active leg to 501–501 and could discard the original scorer's visits and statistics. Exclusive leases later caused legitimate same-board tablets to lose access after refresh or reconnection.

**How to apply:** Persist every accepted visit before updating the scorer UI or broadcasting it. Fetch fresh board data before hydrating on remount; validate the paired session and current assignment on each scorer route, not a lease. Consume the snapshot during checkout, rotate it transactionally for the next leg, and clear it on authoritative reset or finalization. Match-version checks alone do not prevent concurrent same-version snapshot overwrites; treat that as a separate concurrency concern.