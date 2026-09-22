-- Stage 1 scoring integrity follow-up.
-- Additive only: stores the accepted response and durable post-commit state.

ALTER TABLE match_leg_submissions
  ADD COLUMN IF NOT EXISTS resulting_status text,
  ADD COLUMN IF NOT EXISTS resulting_winner_id integer REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS side_effects_completed boolean NOT NULL DEFAULT false;