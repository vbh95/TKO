---
name: Workflow configuration normalization
description: Managed workflow restarts may rewrite unrelated runtime module ordering in .replit.
---

Managed workflow restarts can reorder the same runtime modules in `.replit` and add a final newline, creating an unrelated diff despite no intended configuration change.

**Why:** A validated restore of the original file was followed by another workflow restart that recreated the diff; restoring after the final restart kept the original configuration and the app continued serving.

**How to apply:** When a workflow restart leaves only this unintended formatting change, use the platform's validated configuration replacement after the final restart rather than editing `.replit` directly. Check the app is still serving afterward.