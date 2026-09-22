-- Stage 2 scorer ownership.
-- Additive only: existing matches and sessions remain valid without a lease.

CREATE TABLE IF NOT EXISTS scorer_leases (
  match_id integer PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  tournament_id integer NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  board_number integer NOT NULL,
  board_session_id integer NOT NULL REFERENCES board_sessions(id) ON DELETE CASCADE,
  acquired_at timestamp NOT NULL DEFAULT now(),
  last_activity_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS scorer_leases_tournament_board_idx
  ON scorer_leases (tournament_id, board_number);

CREATE INDEX IF NOT EXISTS scorer_leases_board_session_idx
  ON scorer_leases (board_session_id);

CREATE INDEX IF NOT EXISTS scorer_leases_expires_at_idx
  ON scorer_leases (expires_at);