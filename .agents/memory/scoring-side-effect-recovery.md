---
name: Scoring side-effect recovery
description: Durable rule for handling tournament progression after an accepted leg submission.
---

An accepted leg submission must distinguish a fully processed replay from one whose post-commit tournament progression did not finish. Fully processed replays return the original accepted result without rerunning side effects; unfinished submissions resume the idempotent post-commit work.

**Why:** The score transaction can commit before tournament progression or completion fails. Treating the retry as an ordinary successful replay would leave the bracket or tournament status stale, while rerunning every successful replay can duplicate effects.

**How to apply:** Any new post-commit scoring side effect must finish before marking the submission processed, and it must tolerate retry after partial completion.