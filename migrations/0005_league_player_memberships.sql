-- Private, league-scoped club membership. No existing scoring or player rows are changed.
CREATE TABLE IF NOT EXISTS league_player_memberships (
  id serial PRIMARY KEY,
  league_id integer NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  normalized_player_identity text NOT NULL,
  is_club_member boolean NOT NULL DEFAULT false,
  membership_confirmed_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS league_player_memberships_league_player_uidx
  ON league_player_memberships (league_id, normalized_player_identity);