---
name: Read-only GET endpoints for ratings
description: Why NYCELO GET endpoints must never create rating rows
---
Rule: GET endpoints must never call get-or-create helpers for ELO rating rows; default missing ratings in-memory (1500, zero record) instead.

**Why:** The leaderboard lists every rating row regardless of games played, so a GET that inserts a zero-game row makes unvoted neighborhoods appear on all leaderboards just by being viewed/crawled. A completion review rejected exactly this.

**How to apply:** In read endpoints, select existing rating rows and fall back to defaults; treat "ranked" as "has a rating row" to stay consistent with leaderboard semantics.
