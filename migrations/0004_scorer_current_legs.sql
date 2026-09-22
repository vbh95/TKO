-- Stage 2B durable unfinished-leg recovery.
-- Additive and safe before application rollout: older code does not reference
-- this table, and existing match/history rows are unchanged.

CREATE TABLE IF NOT EXISTS scorer_current_legs (
  match_id integer PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  scoring_version integer NOT NULL,
  remaining_a integer NOT NULL CHECK (remaining_a >= 0 AND remaining_a <= 501),
  remaining_b integer NOT NULL CHECK (remaining_b >= 0 AND remaining_b <= 501),
  current_thrower text NOT NULL CHECK (current_thrower IN ('A', 'B')),
  leg_starting_thrower text NOT NULL CHECK (leg_starting_thrower IN ('A', 'B')),
  visits jsonb NOT NULL DEFAULT '[]'::jsonb,
  checkout_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_checkout jsonb,
  swap_players boolean NOT NULL DEFAULT false,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scorer_current_legs_scoring_version_idx
  ON scorer_current_legs (scoring_version);