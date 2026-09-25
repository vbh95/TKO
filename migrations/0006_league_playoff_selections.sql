-- Private, league-scoped playoff shortlist. Selection identity is shared with
-- league standings and private player profiles; no player rows are created.
CREATE TABLE IF NOT EXISTS league_playoff_selections (
  id serial PRIMARY KEY,
  league_id integer NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  normalized_player_identity text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS league_playoff_selections_league_player_uidx
  ON league_playoff_selections (league_id, normalized_player_identity);