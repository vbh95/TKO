ALTER TABLE ONLY public.beta_feedback ALTER COLUMN id SET DEFAULT nextval('public.beta_feedback_id_seq'::regclass);
ALTER TABLE ONLY public.board_sessions ALTER COLUMN id SET DEFAULT nextval('public.board_sessions_id_seq'::regclass);
ALTER TABLE ONLY public.group_memberships ALTER COLUMN id SET DEFAULT nextval('public.group_memberships_id_seq'::regclass);
ALTER TABLE ONLY public.groups ALTER COLUMN id SET DEFAULT nextval('public.groups_id_seq'::regclass);
ALTER TABLE ONLY public.league_manual_results ALTER COLUMN id SET DEFAULT nextval('public.league_manual_results_id_seq'::regclass);
ALTER TABLE ONLY public.leagues ALTER COLUMN id SET DEFAULT nextval('public.leagues_id_seq'::regclass);
ALTER TABLE ONLY public.match_notes ALTER COLUMN id SET DEFAULT nextval('public.match_notes_id_seq'::regclass);
ALTER TABLE ONLY public.matches ALTER COLUMN id SET DEFAULT nextval('public.matches_id_seq'::regclass);
ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);
ALTER TABLE ONLY public.tournaments ALTER COLUMN id SET DEFAULT nextval('public.tournaments_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.beta_feedback
ALTER TABLE ONLY public.board_sessions
ALTER TABLE ONLY public.board_sessions
ALTER TABLE ONLY public.group_memberships
ALTER TABLE ONLY public.groups
ALTER TABLE ONLY public.league_manual_results
ALTER TABLE ONLY public.leagues
ALTER TABLE ONLY public.leagues
ALTER TABLE ONLY public.match_notes
ALTER TABLE ONLY public.match_notes
ALTER TABLE ONLY public.matches
ALTER TABLE ONLY public.players
ALTER TABLE ONLY public.user_sessions
ALTER TABLE ONLY public.tournaments
ALTER TABLE ONLY public.users
ALTER TABLE ONLY public.users
CREATE INDEX "IDX_session_expire" ON public.user_sessions USING btree (expire);
ALTER TABLE ONLY public.beta_feedback
ALTER TABLE ONLY public.board_sessions
ALTER TABLE ONLY public.group_memberships
ALTER TABLE ONLY public.group_memberships
ALTER TABLE ONLY public.groups
ALTER TABLE ONLY public.league_manual_results
ALTER TABLE ONLY public.leagues
ALTER TABLE ONLY public.match_notes
ALTER TABLE ONLY public.matches
ALTER TABLE ONLY public.matches
ALTER TABLE ONLY public.matches
ALTER TABLE ONLY public.matches
ALTER TABLE ONLY public.matches
ALTER TABLE ONLY public.matches
ALTER TABLE ONLY public.players
ALTER TABLE ONLY public.tournaments
ALTER TABLE ONLY public.tournaments
