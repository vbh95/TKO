-- Stage 1 scoring integrity.
-- Additive only: no existing data is removed or rewritten.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS scoring_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS match_leg_submissions (
  id serial PRIMARY KEY,
  match_id integer NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  submission_id text NOT NULL,
  expected_version integer NOT NULL,
  resulting_version integer NOT NULL,
  resulting_score_a integer NOT NULL,
  resulting_score_b integer NOT NULL,
  request_payload jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS match_leg_submissions_match_submission_uidx
  ON match_leg_submissions (match_id, submission_id);