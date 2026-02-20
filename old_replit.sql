--
-- PostgreSQL database dump
--

\restrict sNEarKowSB0NY1hdo2pQVTUZaGVOhoyhrm8yLr23SSxce7YKxD6xhSASZCbkfpR

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: board_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.board_sessions (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    board_number integer NOT NULL,
    pairing_token text NOT NULL,
    access_token text,
    expires_at timestamp without time zone,
    paired_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: board_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.board_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: board_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.board_sessions_id_seq OWNED BY public.board_sessions.id;


--
-- Name: group_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_memberships (
    id integer NOT NULL,
    group_id integer NOT NULL,
    player_id integer NOT NULL
);


--
-- Name: group_memberships_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.group_memberships_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: group_memberships_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.group_memberships_id_seq OWNED BY public.group_memberships.id;


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    name text NOT NULL
);


--
-- Name: groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.groups_id_seq OWNED BY public.groups.id;


--
-- Name: league_manual_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.league_manual_results (
    id integer NOT NULL,
    league_id integer NOT NULL,
    player_name text NOT NULL,
    tournament_label text NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    legs_won integer DEFAULT 0 NOT NULL,
    legs_lost integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: league_manual_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.league_manual_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: league_manual_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.league_manual_results_id_seq OWNED BY public.league_manual_results.id;


--
-- Name: leagues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leagues (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    end_date text,
    promotion_count integer DEFAULT 0,
    relegation_count integer DEFAULT 0,
    start_date text
);


--
-- Name: leagues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leagues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leagues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leagues_id_seq OWNED BY public.leagues.id;


--
-- Name: match_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_notes (
    id integer NOT NULL,
    match_id integer NOT NULL,
    highest_checkout integer,
    number_of_180s integer DEFAULT 0,
    custom_note text,
    total_visits_a integer,
    total_visits_b integer,
    total_scored_a integer,
    total_scored_b integer,
    highest_visit_a integer,
    highest_visit_b integer,
    highest_finish_a integer,
    highest_finish_b integer,
    ton80s_a integer,
    ton80s_b integer,
    ton40s_a integer,
    ton40s_b integer,
    tons_a integer,
    tons_b integer,
    checkout_attempts_a integer,
    checkout_attempts_b integer,
    checkout_success_a integer,
    checkout_success_b integer
);


--
-- Name: match_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.match_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: match_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.match_notes_id_seq OWNED BY public.match_notes.id;


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    stage text NOT NULL,
    round_key text NOT NULL,
    group_id integer,
    player_a_id integer,
    player_b_id integer,
    score_a integer DEFAULT 0,
    score_b integer DEFAULT 0,
    best_of integer NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    winner_id integer,
    "order" integer NOT NULL,
    board_number integer,
    scorer_id integer,
    scorer_name text
);


--
-- Name: matches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.matches_id_seq OWNED BY public.matches.id;


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id integer NOT NULL,
    tournament_id integer NOT NULL,
    name text NOT NULL,
    seed integer
);


--
-- Name: players_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.players_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.players_id_seq OWNED BY public.players.id;


--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'NOT_STARTED'::text NOT NULL,
    settings jsonb NOT NULL,
    share_enabled boolean DEFAULT false,
    share_token text,
    share_token_created_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    league_id integer,
    is_legacy boolean DEFAULT false,
    event_date text
);


--
-- Name: tournaments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournaments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournaments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournaments_id_seq OWNED BY public.tournaments.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    date_of_birth text,
    phone text,
    billing_address text,
    memorable_word text
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: board_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_sessions ALTER COLUMN id SET DEFAULT nextval('public.board_sessions_id_seq'::regclass);


--
-- Name: group_memberships id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_memberships ALTER COLUMN id SET DEFAULT nextval('public.group_memberships_id_seq'::regclass);


--
-- Name: groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups ALTER COLUMN id SET DEFAULT nextval('public.groups_id_seq'::regclass);


--
-- Name: league_manual_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_manual_results ALTER COLUMN id SET DEFAULT nextval('public.league_manual_results_id_seq'::regclass);


--
-- Name: leagues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leagues ALTER COLUMN id SET DEFAULT nextval('public.leagues_id_seq'::regclass);


--
-- Name: match_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_notes ALTER COLUMN id SET DEFAULT nextval('public.match_notes_id_seq'::regclass);


--
-- Name: matches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches ALTER COLUMN id SET DEFAULT nextval('public.matches_id_seq'::regclass);


--
-- Name: players id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);


--
-- Name: tournaments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments ALTER COLUMN id SET DEFAULT nextval('public.tournaments_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: board_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.board_sessions (id, tournament_id, board_number, pairing_token, access_token, expires_at, paired_at, created_at) FROM stdin;
\.


--
-- Data for Name: group_memberships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.group_memberships (id, group_id, player_id) FROM stdin;
1	1	81
2	1	82
3	1	83
4	2	84
5	2	85
6	2	86
7	3	87
8	3	88
9	3	89
10	4	90
11	4	91
12	4	92
659	98	483
660	98	495
661	98	491
662	98	487
663	99	492
664	99	480
665	99	488
666	99	476
667	99	496
668	100	481
669	100	493
670	100	497
671	100	485
672	101	482
673	101	478
674	101	486
675	101	490
676	100	477
197	28	277
198	28	278
199	28	279
200	28	280
731	108	755
736	109	756
49	9	129
50	9	130
51	9	131
52	9	132
53	10	133
54	10	134
55	10	135
56	10	136
57	10	137
58	10	138
741	110	749
743	110	745
744	111	754
746	111	762
747	111	750
750	108	739
751	108	759
752	108	751
753	108	747
754	109	744
755	109	752
756	109	760
611	98	475
757	109	748
758	109	740
759	110	753
615	98	479
760	110	757
761	110	741
762	110	761
763	111	742
620	99	484
764	111	758
765	108	743
766	111	746
625	100	489
95	15	175
96	15	176
97	15	177
98	15	178
99	15	179
100	15	180
630	101	494
273	39	353
274	39	354
275	39	355
276	39	356
277	39	357
278	39	358
279	40	359
280	40	360
281	40	361
282	40	362
283	40	363
284	40	364
285	41	365
286	41	366
287	41	367
288	41	368
289	41	369
290	41	370
291	42	371
292	42	372
293	42	373
294	42	374
295	42	375
296	42	376
634	101	498
815	117	859
819	117	863
824	118	868
829	119	873
834	120	878
838	120	882
839	118	860
840	119	861
841	120	862
842	118	864
843	119	865
844	120	866
845	117	867
846	119	869
847	120	870
848	117	871
849	118	872
850	120	874
851	117	875
852	118	876
853	119	877
855	117	879
856	118	880
857	119	881
\.


--
-- Data for Name: groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.groups (id, tournament_id, name) FROM stdin;
1	4	Group A
2	4	Group B
3	5	Group A
4	5	Group B
9	7	Group A
10	8	Group A
15	10	Group A
98	23	Group A
99	23	Group B
100	23	Group C
28	14	Group A
101	23	Group D
39	18	Group A
40	18	Group B
41	18	Group C
42	18	Group D
108	26	Group A
109	26	Group B
110	26	Group C
111	26	Group D
117	29	Group A
118	29	Group B
119	29	Group C
120	29	Group D
\.


--
-- Data for Name: league_manual_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.league_manual_results (id, league_id, player_name, tournament_label, points, legs_won, legs_lost, created_at) FROM stdin;
\.


--
-- Data for Name: leagues; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leagues (id, user_id, name, created_at, end_date, promotion_count, relegation_count, start_date) FROM stdin;
1	2	TKO - 2025/2026	2026-02-17 18:32:00.40948	2026-11-13	6	0	\N
\.


--
-- Data for Name: match_notes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.match_notes (id, match_id, highest_checkout, number_of_180s, custom_note, total_visits_a, total_visits_b, total_scored_a, total_scored_b, highest_visit_a, highest_visit_b, highest_finish_a, highest_finish_b, ton80s_a, ton80s_b, ton40s_a, ton40s_b, tons_a, tons_b, checkout_attempts_a, checkout_attempts_b, checkout_success_a, checkout_success_b) FROM stdin;
\.


--
-- Data for Name: matches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.matches (id, tournament_id, stage, round_key, group_id, player_a_id, player_b_id, score_a, score_b, best_of, status, winner_id, "order", board_number, scorer_id, scorer_name) FROM stdin;
1	4	GROUP	group	1	81	82	0	0	3	PENDING	\N	0	\N	\N	\N
2	4	GROUP	group	1	81	83	0	0	3	PENDING	\N	1	\N	\N	\N
3	4	GROUP	group	1	82	83	0	0	3	PENDING	\N	2	\N	\N	\N
4	4	GROUP	group	2	84	85	0	0	3	PENDING	\N	3	\N	\N	\N
5	4	GROUP	group	2	84	86	0	0	3	PENDING	\N	4	\N	\N	\N
6	4	GROUP	group	2	85	86	0	0	3	PENDING	\N	5	\N	\N	\N
7	5	GROUP	group	3	87	88	0	0	3	PENDING	\N	0	\N	\N	\N
8	5	GROUP	group	3	87	89	0	0	3	PENDING	\N	1	\N	\N	\N
9	5	GROUP	group	3	88	89	0	0	3	PENDING	\N	2	\N	\N	\N
10	5	GROUP	group	4	90	91	0	0	3	PENDING	\N	3	\N	\N	\N
11	5	GROUP	group	4	90	92	0	0	3	PENDING	\N	4	\N	\N	\N
12	5	GROUP	group	4	91	92	0	0	3	PENDING	\N	5	\N	\N	\N
721	14	GROUP	R1	28	278	279	0	0	3	PENDING	\N	1	\N	\N	\N
722	14	GROUP	R2	28	277	278	0	0	3	PENDING	\N	2	\N	\N	\N
723	14	GROUP	R2	28	279	280	0	0	3	PENDING	\N	3	\N	\N	\N
724	14	GROUP	R3	28	277	279	0	0	3	PENDING	\N	4	\N	\N	\N
725	14	GROUP	R3	28	280	278	0	0	3	PENDING	\N	5	\N	\N	\N
720	14	GROUP	R1	28	277	280	2	1	3	COMPLETED	277	0	\N	\N	\N
3297	26	GROUP	R1	108	743	755	1	2	3	COMPLETED	755	1	\N	759	Jnr Joyce
3298	26	GROUP	R1	108	747	751	0	2	3	COMPLETED	751	2	\N	755	Wayne Sleat
3308	26	GROUP	R5	108	739	755	2	0	3	COMPLETED	739	12	\N	743	Jonathan Bonner
3309	26	GROUP	R5	108	759	751	2	0	3	COMPLETED	759	13	\N	755	Wayne Sleat
3310	26	GROUP	R5	108	743	747	2	1	3	COMPLETED	743	14	\N	751	Mark Burbury
3305	26	GROUP	R4	108	739	751	1	2	3	COMPLETED	751	9	\N	759	Jnr Joyce
3306	26	GROUP	R4	108	755	747	2	0	3	COMPLETED	755	10	\N	739	Rowan Schumann
3307	26	GROUP	R4	108	759	743	2	0	3	COMPLETED	759	11	\N	747	Katie Glynn
3302	26	GROUP	R3	108	739	747	0	2	3	COMPLETED	747	6	\N	755	Wayne Sleat
3304	26	GROUP	R3	108	755	759	0	2	3	COMPLETED	759	8	\N	743	Jonathan Bonner
3299	26	GROUP	R2	108	739	743	2	0	3	COMPLETED	739	3	\N	751	Mark Burbury
3300	26	GROUP	R2	108	747	759	0	2	3	COMPLETED	759	4	\N	743	Jonathan Bonner
3312	26	GROUP	R1	109	744	756	2	0	3	COMPLETED	744	16	\N	740	Philip Schumann
164	7	GROUP	group	9	129	132	0	0	3	PENDING	\N	0	\N	\N	\N
165	7	GROUP	group	9	130	131	0	0	3	PENDING	\N	1	\N	\N	\N
166	7	GROUP	group	9	129	130	0	0	3	PENDING	\N	2	\N	\N	\N
167	7	GROUP	group	9	131	132	0	0	3	PENDING	\N	3	\N	\N	\N
168	7	GROUP	group	9	129	131	0	0	3	PENDING	\N	4	\N	\N	\N
169	7	GROUP	group	9	132	130	0	0	3	PENDING	\N	5	\N	\N	\N
170	8	GROUP	group	10	133	138	0	0	3	PENDING	\N	0	\N	\N	\N
171	8	GROUP	group	10	134	137	0	0	3	PENDING	\N	1	\N	\N	\N
172	8	GROUP	group	10	135	136	0	0	3	PENDING	\N	2	\N	\N	\N
173	8	GROUP	group	10	133	134	0	0	3	PENDING	\N	3	\N	\N	\N
174	8	GROUP	group	10	135	138	0	0	3	PENDING	\N	4	\N	\N	\N
175	8	GROUP	group	10	136	137	0	0	3	PENDING	\N	5	\N	\N	\N
176	8	GROUP	group	10	133	135	0	0	3	PENDING	\N	6	\N	\N	\N
3311	26	GROUP	R1	109	740	760	0	2	3	COMPLETED	760	15	\N	752	Jason Melly
3313	26	GROUP	R1	109	748	752	0	2	3	COMPLETED	752	17	\N	756	Luke Smith
3323	26	GROUP	R5	109	740	756	0	2	3	COMPLETED	756	27	\N	744	Martin Tonks
3324	26	GROUP	R5	109	760	752	0	2	3	COMPLETED	752	28	\N	756	Luke Smith
3325	26	GROUP	R5	109	744	748	2	0	3	COMPLETED	744	29	\N	760	Ryan Butler
3320	26	GROUP	R4	109	740	752	0	2	3	COMPLETED	752	24	\N	760	Ryan Butler
3322	26	GROUP	R4	109	760	744	0	2	3	COMPLETED	744	26	\N	748	Morgan Ward
3317	26	GROUP	R3	109	740	748	1	2	3	COMPLETED	748	21	\N	756	Luke Smith
3318	26	GROUP	R3	109	752	744	0	2	3	COMPLETED	744	22	\N	748	Morgan Ward
3319	26	GROUP	R3	109	756	760	2	0	3	COMPLETED	756	23	\N	744	Martin Tonks
3314	26	GROUP	R2	109	740	744	0	2	3	COMPLETED	744	18	\N	752	Jason Melly
3315	26	GROUP	R2	109	748	760	1	2	3	COMPLETED	760	19	\N	744	Martin Tonks
3316	26	GROUP	R2	109	752	756	2	0	3	COMPLETED	752	20	\N	760	Ryan Butler
3334	26	GROUP	R3	110	761	741	0	2	3	COMPLETED	741	38	\N	753	John Philpot
3340	26	GROUP	R5	110	749	753	2	1	3	COMPLETED	749	44	\N	757	Taylor Mcguckian
3339	26	GROUP	R5	110	741	757	1	2	3	COMPLETED	757	43	\N	745	Karl Mcdonald
3336	26	GROUP	R4	110	761	753	1	2	3	COMPLETED	753	40	\N	757	Taylor Mcguckian
3329	26	GROUP	R2	110	745	749	2	0	3	COMPLETED	745	33	\N	757	Taylor Mcguckian
3330	26	GROUP	R2	110	753	741	2	0	3	COMPLETED	753	34	\N	749	Shane Stanley
3333	26	GROUP	R3	110	757	749	2	0	3	COMPLETED	757	37	\N	745	Karl Mcdonald
3338	26	GROUP	R5	110	745	761	2	0	3	COMPLETED	745	42	\N	749	Shane Stanley
3337	26	GROUP	R4	110	741	749	2	0	3	COMPLETED	741	41	\N	753	John Philpot
3332	26	GROUP	R3	110	745	753	2	1	3	COMPLETED	745	36	\N	761	Hallam Gill
3331	26	GROUP	R2	110	757	761	2	0	3	COMPLETED	757	35	\N	741	Phil Compton
3327	26	GROUP	R1	110	749	761	2	1	3	COMPLETED	749	31	\N	741	Phil Compton
3328	26	GROUP	R1	110	753	757	2	0	3	COMPLETED	753	32	\N	761	Hallam Gill
3341	26	GROUP	R1	111	742	762	1	2	3	COMPLETED	762	45	\N	750	Billy Stansell
3342	26	GROUP	R1	111	746	758	2	1	3	COMPLETED	746	46	\N	742	Josh Turner
3343	26	GROUP	R1	111	750	754	1	2	3	COMPLETED	754	47	\N	762	Jordon Jones
3347	26	GROUP	R3	111	742	750	0	2	3	COMPLETED	750	51	\N	758	Joe Smiton
3348	26	GROUP	R3	111	754	746	2	1	3	COMPLETED	754	52	\N	750	Billy Stansell
3349	26	GROUP	R3	111	758	762	0	2	3	COMPLETED	762	53	\N	746	Jim Woodall
3344	26	GROUP	R2	111	742	746	0	2	3	COMPLETED	746	48	\N	758	Joe Smiton
3345	26	GROUP	R2	111	750	762	0	2	3	COMPLETED	762	49	\N	746	Jim Woodall
3350	26	GROUP	R4	111	742	754	2	1	3	COMPLETED	742	54	\N	762	Jordon Jones
3351	26	GROUP	R4	111	758	750	1	2	3	COMPLETED	750	55	\N	754	Mark North
3301	26	GROUP	R2	108	751	755	1	2	3	COMPLETED	755	5	\N	759	Jnr Joyce
177	8	GROUP	group	10	136	134	0	0	3	PENDING	\N	7	\N	\N	\N
178	8	GROUP	group	10	137	138	0	0	3	PENDING	\N	8	\N	\N	\N
179	8	GROUP	group	10	133	136	0	0	3	PENDING	\N	9	\N	\N	\N
180	8	GROUP	group	10	137	135	0	0	3	PENDING	\N	10	\N	\N	\N
181	8	GROUP	group	10	138	134	0	0	3	PENDING	\N	11	\N	\N	\N
182	8	GROUP	group	10	133	137	0	0	3	PENDING	\N	12	\N	\N	\N
183	8	GROUP	group	10	138	136	0	0	3	PENDING	\N	13	\N	\N	\N
184	8	GROUP	group	10	134	135	0	0	3	PENDING	\N	14	\N	\N	\N
1024	18	GROUP	R5	40	360	361	0	2	3	COMPLETED	361	29	\N	\N	\N
1025	18	GROUP	R1	41	365	370	2	0	3	COMPLETED	365	30	\N	\N	\N
1040	18	GROUP	R1	42	371	376	2	0	3	COMPLETED	371	45	\N	\N	\N
997	18	GROUP	R1	39	355	356	2	0	3	COMPLETED	355	2	\N	\N	\N
1020	18	GROUP	R4	40	363	361	2	0	3	COMPLETED	363	25	\N	\N	\N
1026	18	GROUP	R1	41	366	369	2	0	3	COMPLETED	366	31	\N	\N	\N
1027	18	GROUP	R1	41	367	368	2	0	3	COMPLETED	367	32	\N	\N	\N
1028	18	GROUP	R2	41	365	366	2	0	3	COMPLETED	365	33	\N	\N	\N
1029	18	GROUP	R2	41	367	370	2	0	3	COMPLETED	367	34	\N	\N	\N
1030	18	GROUP	R2	41	368	369	2	0	3	COMPLETED	368	35	\N	\N	\N
1031	18	GROUP	R3	41	365	367	2	0	3	COMPLETED	365	36	\N	\N	\N
1032	18	GROUP	R3	41	368	366	2	0	3	COMPLETED	368	37	\N	\N	\N
1033	18	GROUP	R3	41	369	370	2	0	3	COMPLETED	369	38	\N	\N	\N
1034	18	GROUP	R4	41	365	368	2	0	3	COMPLETED	365	39	\N	\N	\N
1035	18	GROUP	R4	41	369	367	2	0	3	COMPLETED	369	40	\N	\N	\N
1036	18	GROUP	R4	41	370	366	2	0	3	COMPLETED	370	41	\N	\N	\N
1037	18	GROUP	R5	41	365	369	2	0	3	COMPLETED	365	42	\N	\N	\N
1038	18	GROUP	R5	41	370	368	2	0	3	COMPLETED	370	43	\N	\N	\N
1039	18	GROUP	R5	41	366	367	2	0	3	COMPLETED	366	44	\N	\N	\N
1041	18	GROUP	R1	42	372	375	2	0	3	COMPLETED	372	46	\N	\N	\N
1042	18	GROUP	R1	42	373	374	2	0	3	COMPLETED	373	47	\N	\N	\N
1043	18	GROUP	R2	42	371	372	2	0	3	COMPLETED	371	48	\N	\N	\N
1044	18	GROUP	R2	42	373	376	2	0	3	COMPLETED	373	49	\N	\N	\N
1045	18	GROUP	R2	42	374	375	2	0	3	COMPLETED	374	50	\N	\N	\N
1046	18	GROUP	R3	42	371	373	2	0	3	COMPLETED	371	51	\N	\N	\N
1047	18	GROUP	R3	42	374	372	2	0	3	COMPLETED	374	52	\N	\N	\N
1048	18	GROUP	R3	42	375	376	2	0	3	COMPLETED	375	53	\N	\N	\N
1049	18	GROUP	R4	42	371	374	2	0	3	COMPLETED	371	54	\N	\N	\N
1050	18	GROUP	R4	42	375	373	2	0	3	COMPLETED	375	55	\N	\N	\N
2361	23	KNOCKOUT	QF	\N	489	482	0	3	5	COMPLETED	482	63	4	490	Rowan Schumann
2359	23	KNOCKOUT	QF	\N	479	492	1	3	5	COMPLETED	492	61	2	496	Scott Smith
2360	23	KNOCKOUT	QF	\N	481	498	3	1	5	COMPLETED	481	62	3	478	Ryan Butler
2362	23	KNOCKOUT	SF	\N	483	482	3	1	5	COMPLETED	483	64	2	\N	\N
3353	26	GROUP	R5	111	742	758	2	1	3	COMPLETED	742	57	\N	746	Jim Woodall
2358	23	KNOCKOUT	QF	\N	483	484	3	1	5	COMPLETED	483	60	1	476	Mark Hickey
3354	26	GROUP	R5	111	762	754	0	2	3	COMPLETED	754	58	\N	742	Josh Turner
3355	26	GROUP	R5	111	746	750	1	2	3	COMPLETED	750	59	\N	754	Mark North
3352	26	GROUP	R4	111	762	746	2	1	3	COMPLETED	762	56	\N	750	Billy Stansell
1051	18	GROUP	R4	42	376	372	2	0	3	COMPLETED	376	56	\N	\N	\N
1052	18	GROUP	R5	42	371	375	2	0	3	COMPLETED	371	57	\N	\N	\N
1053	18	GROUP	R5	42	376	374	2	0	3	COMPLETED	376	58	\N	\N	\N
1054	18	GROUP	R5	42	372	373	2	0	3	COMPLETED	372	59	\N	\N	\N
995	18	GROUP	R1	39	353	358	0	2	3	COMPLETED	358	0	\N	\N	\N
1057	18	KNOCKOUT	QF	\N	365	372	3	0	5	COMPLETED	365	62	\N	367	Z
1058	18	KNOCKOUT	QF	\N	358	359	3	0	5	COMPLETED	358	63	\N	356	P
1059	18	KNOCKOUT	SF	\N	353	366	2	0	7	COMPLETED	353	64	\N	\N	\N
1060	18	KNOCKOUT	SF	\N	365	358	2	0	7	COMPLETED	365	65	\N	\N	\N
1061	18	KNOCKOUT	F	\N	353	365	2	0	9	COMPLETED	353	66	\N	\N	\N
1055	18	KNOCKOUT	QF	\N	353	361	2	0	5	COMPLETED	353	60	\N	354	F
1056	18	KNOCKOUT	QF	\N	366	371	2	0	5	COMPLETED	366	61	\N	369	E
2363	23	KNOCKOUT	SF	\N	481	492	3	2	5	COMPLETED	481	65	3	\N	\N
2364	23	KNOCKOUT	F	\N	483	481	3	4	7	COMPLETED	481	66	3	\N	\N
336	10	GROUP	R1	15	175	180	0	0	3	PENDING	\N	0	\N	\N	\N
337	10	GROUP	R1	15	176	179	0	0	3	PENDING	\N	1	\N	\N	\N
338	10	GROUP	R1	15	177	178	0	0	3	PENDING	\N	2	\N	\N	\N
339	10	GROUP	R2	15	175	176	0	0	3	PENDING	\N	3	\N	\N	\N
340	10	GROUP	R2	15	177	180	0	0	3	PENDING	\N	4	\N	\N	\N
341	10	GROUP	R2	15	178	179	0	0	3	PENDING	\N	5	\N	\N	\N
342	10	GROUP	R3	15	175	177	0	0	3	PENDING	\N	6	\N	\N	\N
343	10	GROUP	R3	15	178	176	0	0	3	PENDING	\N	7	\N	\N	\N
344	10	GROUP	R3	15	179	180	0	0	3	PENDING	\N	8	\N	\N	\N
345	10	GROUP	R4	15	175	178	0	0	3	PENDING	\N	9	\N	\N	\N
346	10	GROUP	R4	15	179	177	0	0	3	PENDING	\N	10	\N	\N	\N
347	10	GROUP	R4	15	180	176	0	0	3	PENDING	\N	11	\N	\N	\N
348	10	GROUP	R5	15	175	179	0	0	3	PENDING	\N	12	\N	\N	\N
349	10	GROUP	R5	15	180	178	0	0	3	PENDING	\N	13	\N	\N	\N
350	10	GROUP	R5	15	176	177	0	0	3	PENDING	\N	14	\N	\N	\N
996	18	GROUP	R1	39	354	357	2	0	3	COMPLETED	354	1	\N	\N	\N
998	18	GROUP	R2	39	353	354	2	0	3	COMPLETED	353	3	\N	\N	\N
999	18	GROUP	R2	39	355	358	2	0	3	COMPLETED	355	4	\N	\N	\N
1000	18	GROUP	R2	39	356	357	2	0	3	COMPLETED	356	5	\N	\N	\N
1001	18	GROUP	R3	39	353	355	2	0	3	COMPLETED	353	6	\N	\N	\N
1002	18	GROUP	R3	39	356	354	2	0	3	COMPLETED	356	7	\N	\N	\N
1003	18	GROUP	R3	39	357	358	2	0	3	COMPLETED	357	8	\N	\N	\N
1004	18	GROUP	R4	39	353	356	2	0	3	COMPLETED	353	9	\N	\N	\N
1005	18	GROUP	R4	39	357	355	2	0	3	COMPLETED	357	10	\N	\N	\N
1006	18	GROUP	R4	39	358	354	2	0	3	COMPLETED	358	11	\N	\N	\N
1007	18	GROUP	R5	39	353	357	2	0	3	COMPLETED	353	12	\N	\N	\N
1008	18	GROUP	R5	39	358	356	2	0	3	COMPLETED	358	13	\N	\N	\N
1009	18	GROUP	R5	39	354	355	2	0	3	COMPLETED	354	14	\N	\N	\N
1010	18	GROUP	R1	40	359	364	2	0	3	COMPLETED	359	15	\N	\N	\N
1011	18	GROUP	R1	40	360	363	2	0	3	COMPLETED	360	16	\N	\N	\N
1012	18	GROUP	R1	40	361	362	2	0	3	COMPLETED	361	17	\N	\N	\N
1013	18	GROUP	R2	40	359	360	2	0	3	COMPLETED	359	18	\N	\N	\N
1014	18	GROUP	R2	40	361	364	2	0	3	COMPLETED	361	19	\N	\N	\N
1015	18	GROUP	R2	40	362	363	2	0	3	COMPLETED	362	20	\N	\N	\N
1016	18	GROUP	R3	40	359	361	2	0	3	COMPLETED	359	21	\N	\N	\N
1017	18	GROUP	R3	40	362	360	2	0	3	COMPLETED	362	22	\N	\N	\N
1018	18	GROUP	R3	40	363	364	2	0	3	COMPLETED	363	23	\N	\N	\N
1019	18	GROUP	R4	40	359	362	2	0	3	COMPLETED	359	24	\N	\N	\N
1021	18	GROUP	R4	40	364	360	2	0	3	COMPLETED	364	26	\N	\N	\N
1022	18	GROUP	R5	40	359	363	2	0	3	COMPLETED	359	27	\N	\N	\N
1023	18	GROUP	R5	40	364	362	2	0	3	COMPLETED	364	28	\N	\N	\N
2705	23	GROUP	R1	98	483	487	2	0	3	COMPLETED	483	2	\N	491	Philip Schumann
2715	23	GROUP	R5	98	475	491	2	0	3	COMPLETED	475	12	\N	479	Luke Smith
2716	23	GROUP	R5	98	495	487	2	1	3	COMPLETED	495	13	\N	491	Philip Schumann
2703	23	GROUP	R1	98	475	495	1	2	3	COMPLETED	495	0	\N	487	Sean Marron
2704	23	GROUP	R1	98	479	491	1	2	3	COMPLETED	491	1	\N	495	Ryan Smith
2717	23	GROUP	R5	98	479	483	0	2	3	COMPLETED	483	14	\N	487	Sean Marron
2712	23	GROUP	R4	98	475	487	2	0	3	COMPLETED	475	9	\N	495	Ryan Smith
2713	23	GROUP	R4	98	491	483	0	2	3	COMPLETED	483	10	\N	475	Jonathan Bonner
2714	23	GROUP	R4	98	495	479	0	2	3	COMPLETED	479	11	\N	483	Lee Constable
2709	23	GROUP	R3	98	475	483	0	2	3	COMPLETED	483	6	\N	495	Ryan Smith
2710	23	GROUP	R3	98	487	479	0	2	3	COMPLETED	479	7	\N	483	Lee Constable
2711	23	GROUP	R3	98	491	495	0	2	3	COMPLETED	495	8	\N	479	Luke Smith
2706	23	GROUP	R2	98	475	479	1	2	3	COMPLETED	479	3	\N	487	Sean Marron
2707	23	GROUP	R2	98	483	495	2	0	3	COMPLETED	483	4	\N	475	Jonathan Bonner
2708	23	GROUP	R2	98	487	491	0	2	3	COMPLETED	491	5	\N	479	Luke Smith
2718	23	GROUP	R1	99	476	496	2	1	3	COMPLETED	476	15	\N	488	Stu Taylor
2719	23	GROUP	R1	99	480	492	0	2	3	COMPLETED	492	16	\N	476	Mark Hickey
2720	23	GROUP	R1	99	484	488	2	1	3	COMPLETED	484	17	\N	496	Scott Smith
2730	23	GROUP	R5	99	476	492	0	2	3	COMPLETED	492	27	\N	480	Phil Compton
2731	23	GROUP	R5	99	496	488	0	2	3	COMPLETED	488	28	\N	476	Mark Hickey
2732	23	GROUP	R5	99	480	484	0	2	3	COMPLETED	484	29	\N	492	Jason Melly
2727	23	GROUP	R4	99	476	488	0	2	3	COMPLETED	488	24	\N	496	Scott Smith
2728	23	GROUP	R4	99	492	484	2	0	3	COMPLETED	492	25	\N	488	Stu Taylor
2729	23	GROUP	R4	99	496	480	0	2	3	COMPLETED	480	26	\N	484	James Emeney
2724	23	GROUP	R3	99	476	484	1	2	3	COMPLETED	484	21	\N	492	Jason Melly
2725	23	GROUP	R3	99	488	480	1	2	3	COMPLETED	480	22	\N	484	James Emeney
2726	23	GROUP	R3	99	492	496	2	0	3	COMPLETED	492	23	\N	480	Phil Compton
2721	23	GROUP	R2	99	476	480	1	2	3	COMPLETED	480	18	\N	492	Jason Melly
2722	23	GROUP	R2	99	484	496	2	0	3	COMPLETED	484	19	\N	480	Phil Compton
2723	23	GROUP	R2	99	488	492	0	2	3	COMPLETED	492	20	\N	496	Scott Smith
2733	23	GROUP	R1	100	477	497	0	2	3	COMPLETED	497	30	\N	489	Jordan Simpson
2734	23	GROUP	R1	100	481	493	2	0	3	COMPLETED	481	31	\N	477	Ricky Fennell
2735	23	GROUP	R1	100	485	489	0	2	3	COMPLETED	489	32	\N	493	Mark Burbury
2745	23	GROUP	R5	100	477	493	0	2	3	COMPLETED	493	42	\N	481	Liam Elliott
2746	23	GROUP	R5	100	497	489	2	1	3	COMPLETED	497	43	\N	493	Mark Burbury
2747	23	GROUP	R5	100	481	485	2	0	3	COMPLETED	481	44	\N	497	Chazza Rhys-Davies
2742	23	GROUP	R4	100	477	489	0	2	3	COMPLETED	489	39	\N	497	Chazza Rhys-Davies
2743	23	GROUP	R4	100	493	485	2	1	3	COMPLETED	493	40	\N	477	Ricky Fennell
2744	23	GROUP	R4	100	497	481	1	2	3	COMPLETED	481	41	\N	485	Wayne Sleat
2739	23	GROUP	R3	100	477	485	2	0	3	COMPLETED	477	36	\N	493	Mark Burbury
2740	23	GROUP	R3	100	489	481	0	2	3	COMPLETED	481	37	\N	485	Wayne Sleat
2741	23	GROUP	R3	100	493	497	2	0	3	COMPLETED	493	38	\N	481	Liam Elliott
2736	23	GROUP	R2	100	477	481	0	2	3	COMPLETED	481	33	\N	489	Jordan Simpson
2737	23	GROUP	R2	100	485	497	1	2	3	COMPLETED	497	34	\N	481	Liam Elliott
2738	23	GROUP	R2	100	489	493	2	1	3	COMPLETED	489	35	\N	497	Chazza Rhys-Davies
2748	23	GROUP	R1	101	478	498	0	2	3	COMPLETED	498	45	\N	490	Rowan Schumann
2749	23	GROUP	R1	101	482	494	2	0	3	COMPLETED	482	46	\N	498	Shane Stanley
2750	23	GROUP	R1	101	486	490	2	0	3	COMPLETED	486	47	\N	494	John Philpot
2760	23	GROUP	R5	101	478	494	2	0	3	COMPLETED	478	57	\N	482	Martin Tonks
2761	23	GROUP	R5	101	498	490	2	0	3	COMPLETED	498	58	\N	478	Ryan Butler
2762	23	GROUP	R5	101	482	486	2	1	3	COMPLETED	482	59	\N	490	Rowan Schumann
2757	23	GROUP	R4	101	478	490	2	1	3	COMPLETED	478	54	\N	498	Shane Stanley
2758	23	GROUP	R4	101	494	486	2	0	3	COMPLETED	494	55	\N	478	Ryan Butler
2759	23	GROUP	R4	101	498	482	0	2	3	COMPLETED	482	56	\N	486	Cameron Walwyn
2754	23	GROUP	R3	101	478	486	2	0	3	COMPLETED	478	51	\N	494	John Philpot
2755	23	GROUP	R3	101	490	482	1	2	3	COMPLETED	482	52	\N	486	Cameron Walwyn
2756	23	GROUP	R3	101	494	498	2	0	3	COMPLETED	494	53	\N	482	Martin Tonks
2751	23	GROUP	R2	101	478	482	0	2	3	COMPLETED	482	48	\N	490	Rowan Schumann
2752	23	GROUP	R2	101	486	498	1	2	3	COMPLETED	498	49	\N	482	Martin Tonks
2753	23	GROUP	R2	101	490	494	2	0	3	COMPLETED	490	50	\N	498	Shane Stanley
3296	26	GROUP	R1	108	739	759	1	2	3	COMPLETED	759	0	\N	747	Katie Glynn
3303	26	GROUP	R3	108	751	743	2	1	3	COMPLETED	751	7	\N	739	Rowan Schumann
3321	26	GROUP	R4	109	756	748	2	1	3	COMPLETED	756	25	\N	740	Philip Schumann
3335	26	GROUP	R4	110	745	757	2	1	3	COMPLETED	745	39	\N	749	Shane Stanley
3326	26	GROUP	R1	110	745	741	2	0	3	COMPLETED	745	30	\N	753	John Philpot
3346	26	GROUP	R2	111	754	758	2	0	3	COMPLETED	754	50	\N	762	Jordon Jones
3167	26	KNOCKOUT	QF	\N	759	752	3	1	5	COMPLETED	759	60	1	760	Ryan Butler
3170	26	KNOCKOUT	QF	\N	753	754	0	3	5	COMPLETED	754	63	4	750	Billy Stansell
3169	26	KNOCKOUT	QF	\N	745	762	3	0	5	COMPLETED	745	62	3	758	Joe Smiton
3168	26	KNOCKOUT	QF	\N	751	744	0	3	5	COMPLETED	744	61	2	748	Morgan Ward
3171	26	KNOCKOUT	SF	\N	759	754	1	3	5	COMPLETED	754	64	2	\N	\N
3172	26	KNOCKOUT	SF	\N	745	744	3	1	5	COMPLETED	745	65	3	\N	\N
3173	26	KNOCKOUT	F	\N	754	745	4	3	7	COMPLETED	754	66	3	\N	\N
3760	29	GROUP	R1	117	859	879	2	0	3	COMPLETED	859	0	\N	871	Ryan Butler
3761	29	GROUP	R1	117	863	875	1	2	3	COMPLETED	875	1	\N	879	Paul West
3762	29	GROUP	R1	117	867	871	1	2	3	COMPLETED	871	2	\N	875	Chunk Brooke
3772	29	GROUP	R5	117	859	875	1	2	3	COMPLETED	875	12	\N	863	Martin Tonks
3773	29	GROUP	R5	117	879	871	1	2	3	COMPLETED	871	13	\N	875	Chunk Brooke
3774	29	GROUP	R5	117	863	867	2	0	3	COMPLETED	863	14	\N	859	Luke Smith
3769	29	GROUP	R4	117	859	871	2	1	3	COMPLETED	859	9	\N	879	Paul West
3770	29	GROUP	R4	117	875	867	2	0	3	COMPLETED	875	10	\N	859	Luke Smith
3771	29	GROUP	R4	117	879	863	0	2	3	COMPLETED	863	11	\N	867	Rowan Schumann
3766	29	GROUP	R3	117	859	867	2	0	3	COMPLETED	859	6	\N	879	Paul West
3767	29	GROUP	R3	117	871	863	1	2	3	COMPLETED	863	7	\N	867	Rowan Schumann
3768	29	GROUP	R3	117	875	879	2	0	3	COMPLETED	875	8	\N	863	Martin Tonks
3763	29	GROUP	R2	117	859	863	0	2	3	COMPLETED	863	3	\N	871	Ryan Butler
3764	29	GROUP	R2	117	867	879	2	1	3	COMPLETED	867	4	\N	859	Luke Smith
3765	29	GROUP	R2	117	871	875	2	1	3	COMPLETED	871	5	\N	863	Martin Tonks
3753	29	KNOCKOUT	QF	\N	863	880	3	0	5	COMPLETED	863	60	1	868	Philip Schumann
3790	29	GROUP	R1	119	861	881	0	2	3	COMPLETED	881	30	\N	873	Jnr Joyce
3754	29	KNOCKOUT	QF	\N	875	864	3	2	5	COMPLETED	875	61	2	876	Liv Peddle
3755	29	KNOCKOUT	QF	\N	865	862	3	2	5	COMPLETED	865	62	3	874	Jim Woodall
3758	29	KNOCKOUT	SF	\N	865	875	3	2	5	COMPLETED	865	65	3	\N	\N
3775	29	GROUP	R1	118	860	880	0	2	3	COMPLETED	880	15	\N	872	Katie Gylnn
3776	29	GROUP	R1	118	864	876	2	0	3	COMPLETED	864	16	\N	860	John Philpot
3777	29	GROUP	R1	118	868	872	2	1	3	COMPLETED	868	17	\N	880	Jack\tAllen
3787	29	GROUP	R5	118	860	876	2	0	3	COMPLETED	860	27	\N	864	Karl\tMcDonald
3788	29	GROUP	R5	118	880	872	2	1	3	COMPLETED	880	28	\N	860	John Philpot
3789	29	GROUP	R5	118	864	868	2	0	3	COMPLETED	864	29	\N	872	Katie Gylnn
3756	29	KNOCKOUT	QF	\N	873	882	2	3	5	COMPLETED	882	63	4	866	Jordan Simpson
3785	29	GROUP	R4	118	876	868	0	2	3	COMPLETED	868	25	\N	872	Katie Gylnn
3786	29	GROUP	R4	118	880	864	0	2	3	COMPLETED	864	26	\N	868	Philip Schumann
3781	29	GROUP	R3	118	860	868	2	1	3	COMPLETED	860	21	\N	876	Liv Peddle
3782	29	GROUP	R3	118	872	864	0	2	3	COMPLETED	864	22	\N	868	Philip Schumann
3783	29	GROUP	R3	118	876	880	0	2	3	COMPLETED	880	23	\N	864	Karl\tMcDonald
3778	29	GROUP	R2	118	860	864	2	0	3	COMPLETED	860	18	\N	876	Liv Peddle
3779	29	GROUP	R2	118	868	880	0	2	3	COMPLETED	880	19	\N	864	Karl\tMcDonald
3780	29	GROUP	R2	118	872	876	1	2	3	COMPLETED	876	20	\N	880	Jack\tAllen
3791	29	GROUP	R1	119	865	877	2	0	3	COMPLETED	865	31	\N	861	Charlie Maguire
3792	29	GROUP	R1	119	869	873	0	2	3	COMPLETED	873	32	\N	877	Mark Hickey
3802	29	GROUP	R5	119	861	877	0	2	3	COMPLETED	877	42	\N	865	Lee\tConstable
3803	29	GROUP	R5	119	881	873	0	2	3	COMPLETED	873	43	\N	877	Mark Hickey
3804	29	GROUP	R5	119	865	869	2	0	3	COMPLETED	865	44	\N	881	Jonathan Bonner
3799	29	GROUP	R4	119	861	873	2	0	3	COMPLETED	861	39	\N	881	Jonathan Bonner
3800	29	GROUP	R4	119	877	869	1	2	3	COMPLETED	869	40	\N	861	Charlie Maguire
3801	29	GROUP	R4	119	881	865	0	2	3	COMPLETED	865	41	\N	869	Ryan Smith
3796	29	GROUP	R3	119	861	869	2	0	3	COMPLETED	861	36	\N	877	Mark Hickey
3797	29	GROUP	R3	119	873	865	0	2	3	COMPLETED	865	37	\N	869	Ryan Smith
3798	29	GROUP	R3	119	877	881	0	2	3	COMPLETED	881	38	\N	865	Lee\tConstable
3793	29	GROUP	R2	119	861	865	0	2	3	COMPLETED	865	33	\N	873	Jnr Joyce
3794	29	GROUP	R2	119	869	881	2	1	3	COMPLETED	869	34	\N	865	Lee\tConstable
3795	29	GROUP	R2	119	873	877	1	2	3	COMPLETED	877	35	\N	881	Jonathan Bonner
3759	29	KNOCKOUT	F	\N	863	865	4	3	7	COMPLETED	863	66	3	\N	\N
3784	29	GROUP	R4	118	860	872	2	0	3	COMPLETED	860	24	\N	880	Jack\tAllen
3805	29	GROUP	R1	120	862	882	0	2	3	COMPLETED	882	45	\N	874	Jim Woodall
3806	29	GROUP	R1	120	866	878	1	2	3	COMPLETED	878	46	\N	882	Stuart Taylor
3807	29	GROUP	R1	120	870	874	2	0	3	COMPLETED	870	47	\N	878	Philip Compton
3817	29	GROUP	R5	120	862	878	1	2	3	COMPLETED	878	57	\N	866	Jordan Simpson
3819	29	GROUP	R5	120	866	870	2	1	3	COMPLETED	866	59	\N	882	Stuart Taylor
3814	29	GROUP	R4	120	862	874	2	0	3	COMPLETED	862	54	\N	866	Jordan Simpson
3815	29	GROUP	R4	120	878	870	2	1	3	COMPLETED	878	55	\N	862	Mark North
3816	29	GROUP	R4	120	882	866	2	0	3	COMPLETED	882	56	\N	870	Mark Burbury
3811	29	GROUP	R3	120	862	870	2	0	3	COMPLETED	862	51	\N	878	Philip Compton
3812	29	GROUP	R3	120	874	866	1	2	3	COMPLETED	866	52	\N	862	Mark North
3813	29	GROUP	R3	120	878	882	1	2	3	COMPLETED	882	53	\N	870	Mark Burbury
3808	29	GROUP	R2	120	862	866	2	0	3	COMPLETED	862	48	\N	874	Jim Woodall
3809	29	GROUP	R2	120	870	882	0	2	3	COMPLETED	882	49	\N	866	Jordan Simpson
3757	29	KNOCKOUT	SF	\N	863	882	3	0	5	COMPLETED	863	64	2	\N	\N
3818	29	GROUP	R5	120	882	874	2	1	3	COMPLETED	882	58	\N	878	Philip Compton
3810	29	GROUP	R2	120	874	878	2	1	3	COMPLETED	874	50	\N	882	Stuart Taylor
\.


--
-- Data for Name: players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.players (id, tournament_id, name, seed) FROM stdin;
1	1	Alice	2
2	1	Bob	5
3	1	Charlie	2
4	1	Dave	9
5	1	Eve	5
6	1	Frank	5
7	1	Grace	10
8	1	Heidi	4
739	26	Rowan Schumann	\N
740	26	Philip Schumann	\N
859	29	Luke Smith	1
742	26	Josh Turner	\N
743	26	Jonathan Bonner	\N
744	26	Martin Tonks	\N
745	26	Karl Mcdonald	\N
746	26	Jim Woodall	\N
747	26	Katie Glynn	\N
748	26	Morgan Ward	\N
749	26	Shane Stanley	\N
750	26	Billy Stansell	\N
751	26	Mark Burbury	\N
752	26	Jason Melly	\N
753	26	John Philpot	\N
754	26	Mark North	\N
755	26	Wayne Sleat	\N
756	26	Luke Smith	\N
757	26	Taylor Mcguckian	\N
758	26	Joe Smiton	\N
759	26	Jnr Joyce	\N
760	26	Ryan Butler	\N
761	26	Hallam Gill	\N
762	26	Jordon Jones	\N
81	4	Alice	1
82	4	Bob	2
83	4	Charlie	3
84	4	Diana	4
85	4	Eve	5
86	4	Frank	6
87	5	Alice	1
88	5	Bob	2
89	5	Charlie	3
90	5	Diana	4
91	5	Eve	5
92	5	Frank	6
353	18	J	\N
354	18	F	\N
355	18	U	\N
356	18	P	\N
357	18	Q	\N
358	18	K	\N
359	18	X	\N
360	18	H	\N
361	18	B	\N
362	18	T	\N
363	18	I	\N
364	18	V	\N
365	18	N	\N
366	18	C	\N
367	18	Z	\N
368	18	S	\N
369	18	E	\N
370	18	G	\N
371	18	W	\N
372	18	Y	\N
373	18	L	\N
374	18	O	\N
375	18	A	\N
376	18	R	\N
377	18	James	\N
378	18	F	\N
379	18	U	\N
380	18	P	\N
381	18	Q	\N
382	18	K	\N
383	18	X	\N
384	18	H	\N
385	18	B	\N
386	18	T	\N
387	18	I	\N
388	18	V	\N
129	7	Alice	1
130	7	Bob	2
131	7	Charlie	3
132	7	Diana	4
133	8	Alice	1
134	8	Bob	2
135	8	Charlie	3
136	8	Diana	4
137	8	Eve	5
138	8	Frank	6
389	18	N	\N
390	18	C	\N
391	18	Z	\N
392	18	S	\N
393	18	E	\N
394	18	G	\N
395	18	W	\N
396	18	Y	\N
397	18	L	\N
398	18	O	\N
399	18	A	\N
400	18	R	\N
860	29	John Philpot	2
861	29	Charlie Maguire	3
862	29	Mark North	4
863	29	Martin Tonks	5
741	26	Philip Compton	\N
866	29	Jordan Simpson	8
867	29	Rowan Schumann	9
868	29	Philip Schumann	10
869	29	Ryan Smith	11
870	29	Mark Burbury	12
871	29	Ryan Butler	13
864	29	Karl McDonald	6
873	29	Jnr Joyce	15
874	29	Jim Woodall	16
875	29	Chunk Brooke	17
876	29	Liv Peddle	18
877	29	Mark Hickey	19
878	29	Philip Compton	20
879	29	Paul West	21
881	29	Jonathan Bonner	23
882	29	Stuart Taylor	24
872	29	Katie Glynn	14
865	29	Lee Constable	7
880	29	Jack Allen	22
277	14	Player Alpha	1
278	14	Player Beta	2
279	14	Player Gamma	3
280	14	Player Delta	4
175	10	Alice	1
176	10	Bob	2
177	10	Charlie	3
178	10	Diana	4
179	10	Eve	5
180	10	Frank	6
475	23	Jonathan Bonner	1
476	23	Mark Hickey	2
477	23	Ricky Fennell	3
478	23	Ryan Butler	4
479	23	Luke Smith	5
481	23	Liam Elliott	7
482	23	Martin Tonks	8
484	23	James Emeney	10
485	23	Wayne Sleat	11
486	23	Cameron Walwyn	12
487	23	Sean Marron	13
489	23	Jordan Simpson	15
490	23	Rowan Schumann	16
491	23	Philip Schumann	17
492	23	Jason Melly	18
493	23	Mark Burbury	19
494	23	John Philpot	20
495	23	Ryan Smith	21
496	23	Scott Smith	22
497	23	Chazza Rhys-Davies	23
498	23	Shane Stanley	24
483	23	Lee Constable	9
480	23	Philip Compton	6
488	23	Stuart Taylor	14
\.


--
-- Data for Name: tournaments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tournaments (id, user_id, name, type, status, settings, share_enabled, share_token, share_token_created_at, created_at, updated_at, league_id, is_legacy, event_date) FROM stdin;
4	3	RR Test GhSE	ROUND_ROBIN	IN_PROGRESS	{"groupCount": 2, "groupBestOf": 3}	f	\N	\N	2026-02-14 19:41:07.369979	2026-02-14 19:41:07.54	\N	f	\N
5	4	Standings Test WpgZ	ROUND_ROBIN	IN_PROGRESS	{"groupCount": 2, "groupBestOf": 3}	f	\N	\N	2026-02-14 19:45:14.09639	2026-02-14 19:45:14.215	\N	f	\N
7	5	Schedule Test RI5T	ROUND_ROBIN	IN_PROGRESS	{"groupCount": 1, "groupBestOf": 3}	f	\N	\N	2026-02-14 19:51:54.62654	2026-02-14 19:51:54.765	\N	f	\N
8	6	Schedule 6P Test gEGJ	ROUND_ROBIN	IN_PROGRESS	{"groupCount": 1, "groupBestOf": 3}	f	\N	\N	2026-02-14 19:55:08.269557	2026-02-14 19:55:08.382	\N	f	\N
10	7	Points Round Test CjhK	ROUND_ROBIN	IN_PROGRESS	{"groupCount": 1, "groupBestOf": 3, "pointsForWin": 3, "pointsForDraw": 1, "pointsForLoss": 0}	f	\N	\N	2026-02-14 20:11:37.008057	2026-02-14 20:11:37.199	\N	f	\N
1	1	Friday Night Darts	ROUND_ROBIN	IN_PROGRESS	{"groupCount": 2, "matchFormat": {"bestOf": 3}, "promotedPerGroup": 2}	t	test-token-123	\N	2026-02-14 18:28:22.891284	2026-02-14 18:28:22.891284	\N	f	\N
14	10	Score Test Tournament	ROUND_ROBIN	IN_PROGRESS	{"groupCount": 1, "groupBestOf": 3, "pointsForWin": 2, "pointsForDraw": 1, "pointsForLoss": 0}	f	\N	\N	2026-02-14 21:13:54.63177	2026-02-14 21:13:54.763	\N	f	\N
18	12	TEST	MULTI_STAGE	IN_PROGRESS	{"seeded": true, "groupCount": 4, "groupBestOf": 3, "pointsForWin": 2, "pointsForDraw": 0, "pointsForLoss": 0, "knockoutBestOfByRound": {"final": 9, "semiFinal": 7, "quarterFinal": 5}}	f	\N	\N	2026-02-15 03:41:07.320341	2026-02-15 03:41:07.653	\N	f	\N
29	2	The Kineton Open - Feb 2026	MULTI_STAGE	COMPLETED	{"seeded": true, "groupCount": 4, "groupBestOf": 3, "pointsForWin": 2, "pointsForLoss": 0, "knockoutBestOfByRound": {"final": 7, "semiFinal": 5, "quarterFinal": 5}}	f	\N	\N	2026-02-18 21:31:59.504127	2026-02-19 22:47:29.575	1	t	2026-02-13
26	2	The Kineton Open - Jan 2026	MULTI_STAGE	COMPLETED	{"seeded": true, "groupCount": 4, "groupBestOf": 3, "pointsForWin": 2, "pointsForLoss": 0, "knockoutBestOfByRound": {"final": 7, "semiFinal": 5, "quarterFinal": 5}}	f	\N	\N	2026-02-18 00:40:43.876051	2026-02-18 07:22:57.716	1	t	2026-01-09
23	2	The Kineton Open - Dec 2025 	MULTI_STAGE	COMPLETED	{"seeded": true, "groupCount": 4, "groupBestOf": 3, "pointsForWin": 2, "pointsForLoss": 0, "knockoutBestOfByRound": {"final": 7, "semiFinal": 5, "quarterFinal": 5}}	f	\N	\N	2026-02-17 23:45:01.090569	2026-02-18 00:36:26.182	1	t	2025-12-12
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password, name, created_at, date_of_birth, phone, billing_address, memorable_word) FROM stdin;
1	demo@example.com	ce4a15aee4a266190de9733c7b51995b5e57d10b09bc99eb5414cf10e3f9466325757a43048c8351f974590b0642d324385b96b7bcda8f70524c400289dc5e3e.34da476b808ada5eceec5edcbbc9b78b	Demo User	2026-02-14 18:28:22.883832	\N	\N	\N	\N
3	test_matchgen_8QYNfl@test.com	2a09d5b122ed66dfabbc193f5d4fd55aa16c3d86d09d9fb0461f95c058e0caa0192bda537c4e369eced857530e67b583e0f79fb5b64a1390f985fd53bce048e4.04a5d3ff240e0da6d295bbee7cdf9e8f	Test User	2026-02-14 19:40:14.541419	\N	\N	\N	\N
4	test_standcheck_Q9AuPI@test.com	2eefa5e90836914aa2c48ab677baf75e7ec1317271eae680030658a8d928fe05bffdb65ea887888162f0927b51c790c748651ee73efa3c3ef2504e9ca5131623.4358185f20b979489d031ff75abd4de7	Test User 2	2026-02-14 19:44:10.105176	\N	\N	\N	\N
5	test_sched_yKMVX_@test.com	0a13556b1f18f086be3b39b45c52ce14aa53078fc92d2412df6f1b5ce0e022d312d23a33950446b3f54b52d6a035325c9f1f2f6590b3f6f06da08e7019a2948f.86c6dd7fabdb901a5603ea374f85a956	Schedule Tester	2026-02-14 19:51:25.167969	\N	\N	\N	\N
6	test_sched6_SVy927@test.com	a04ae0cd9363c53d13e6947a8711ec92884b7079cc6019e5fd83c49bb96e32ae83a007bd995265ffb2cc265f4a79c824784561acc071a9fa80c09db3bd8cff1e.f58eb00f7af2b1bab841fbca5bb8c393	Schedule Tester 6	2026-02-14 19:54:40.171242	\N	\N	\N	\N
7	test_pts_RkGYWJ@test.com	ff1678aae81b67bd82f636cad9e0a1ccf71dee53e769776feb6d95a335d893d7d91f1505efb4e1391fa5eadfc7050f6ae5dfdbe95a0442eb5f9e4e5386936180.f891cb103f4cc1a11aa4039ec2204f52	Points Tester	2026-02-14 20:10:32.092007	\N	\N	\N	\N
8	test_tab_TrZWuA@test.com	3b2d3f8aeca7f48ef6b6f13a9f7b22a8a3124e805e71e92e8524aeff43259e8e7ea11247382b354e6f0042697b9cab4facdc7ae31dadbf4d61b1b7489a28b374.6013a86767885b4777b6aa15e7fdc1dc	Tab Tester	2026-02-14 20:22:56.293256	\N	\N	\N	\N
9	test_live_y00ykc@test.com	0f6341ae0979873ac54433ea2e6c01964784e308dcb81d1827891a0d9b04e4c1f7f5ce0cc9aaddf1cc7bbb276fe0e13456a950f1441b139e11ae19d714cad004.a3476421ba1e7ed60a267537fd983659	Live Tester	2026-02-14 20:41:29.481166	\N	\N	\N	\N
10	test_score_update@example.com	ed4994870139e198bc0289ed22eff4f494f0c6c5f3218626b26bc25757ef2092e7e8a13eaffa04c4ad408f727c5aedb7b163e0c36512ece7869f46336b22e7cc.140cc821d58e10235d6739c95dfbe67a	Test User	2026-02-14 21:13:23.829448	\N	\N	\N	\N
11	h@123.com	d5d39a6109e56f4e24e62d1e55e1cf77e6500b6fc5c4bbd9eac155807a3d591c4835801a65d2732adaa1875ade65f180144709c564dfa6ab33da7c13778384d4.1ebaf342de5d7a097833629b5b5d723f	H	2026-02-15 03:34:16.266215	\N	\N	\N	\N
12	test@123.com	ef9cfc6291bead06e37fde028320b79ca05f0f56a186b440d6a1c47263fa7126d997dd1b806ca8112e14835ed48a434961f8d3f0149bedb9c5ebffe72859f02b.090b732f530236a55a8af0fc33848626	H	2026-02-15 03:36:11.697311	\N	\N	\N	\N
2	hallam.gill@gmail.com	af96ccfc093d39fc07327d7c5e9a0ce1fa773c313e930b2fbe56185e39b75a6b798987c6d164e4cedfff07e3f9618db24421da5188919d3039694af2828294df.7ebbd4f1688c7002cd9f78c747e2ed03	Hallam Gill	2026-02-14 18:28:55.18405	\N	\N	\N	\N
13	tester45@123.com	28ba116f6abe4f74390e545ca9d6cec1ede3caf66467abb57c10e23beed0fcd56dbd48bfbb017817ef7e626a17d944eb4d5cf5dfbf943de467734e445425bf27.657a242d6af57f9b4ab36114e547f56c	Test	2026-02-16 22:29:16.327572	\N	\N	\N	\N
14	ste@123.com	d2c566f025c19b28016b9b161c27fda8b8986e2e23399008ce1f77c687e3246855275eabe081dbb175a4af21626a289559781d7cd2bc6b03188feb1268478917.d828db061e379bbc621ef71e140644df	Test	2026-02-18 12:46:48.236949	\N	\N	\N	\N
\.


--
-- Name: board_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.board_sessions_id_seq', 13, true);


--
-- Name: group_memberships_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.group_memberships_id_seq', 857, true);


--
-- Name: groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.groups_id_seq', 120, true);


--
-- Name: league_manual_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.league_manual_results_id_seq', 1, false);


--
-- Name: leagues_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leagues_id_seq', 1, true);


--
-- Name: match_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.match_notes_id_seq', 40, true);


--
-- Name: matches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.matches_id_seq', 3819, true);


--
-- Name: players_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.players_id_seq', 882, true);


--
-- Name: tournaments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tournaments_id_seq', 29, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 14, true);


--
-- Name: board_sessions board_sessions_pairing_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_sessions
    ADD CONSTRAINT board_sessions_pairing_token_unique UNIQUE (pairing_token);


--
-- Name: board_sessions board_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_sessions
    ADD CONSTRAINT board_sessions_pkey PRIMARY KEY (id);


--
-- Name: group_memberships group_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_memberships
    ADD CONSTRAINT group_memberships_pkey PRIMARY KEY (id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: league_manual_results league_manual_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_manual_results
    ADD CONSTRAINT league_manual_results_pkey PRIMARY KEY (id);


--
-- Name: leagues leagues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT leagues_pkey PRIMARY KEY (id);


--
-- Name: match_notes match_notes_match_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_notes
    ADD CONSTRAINT match_notes_match_id_unique UNIQUE (match_id);


--
-- Name: match_notes match_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_notes
    ADD CONSTRAINT match_notes_pkey PRIMARY KEY (id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: board_sessions board_sessions_tournament_id_tournaments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.board_sessions
    ADD CONSTRAINT board_sessions_tournament_id_tournaments_id_fk FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: group_memberships group_memberships_group_id_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_memberships
    ADD CONSTRAINT group_memberships_group_id_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: group_memberships group_memberships_player_id_players_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_memberships
    ADD CONSTRAINT group_memberships_player_id_players_id_fk FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: groups groups_tournament_id_tournaments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_tournament_id_tournaments_id_fk FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: league_manual_results league_manual_results_league_id_leagues_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_manual_results
    ADD CONSTRAINT league_manual_results_league_id_leagues_id_fk FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;


--
-- Name: leagues leagues_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT leagues_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: match_notes match_notes_match_id_matches_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_notes
    ADD CONSTRAINT match_notes_match_id_matches_id_fk FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: matches matches_group_id_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_group_id_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: matches matches_player_a_id_players_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_player_a_id_players_id_fk FOREIGN KEY (player_a_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: matches matches_player_b_id_players_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_player_b_id_players_id_fk FOREIGN KEY (player_b_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: matches matches_scorer_id_players_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_scorer_id_players_id_fk FOREIGN KEY (scorer_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: matches matches_tournament_id_tournaments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_tournament_id_tournaments_id_fk FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: matches matches_winner_id_players_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_winner_id_players_id_fk FOREIGN KEY (winner_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: players players_tournament_id_tournaments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_tournament_id_tournaments_id_fk FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;


--
-- Name: tournaments tournaments_league_id_leagues_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_league_id_leagues_id_fk FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE SET NULL;


--
-- Name: tournaments tournaments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict sNEarKowSB0NY1hdo2pQVTUZaGVOhoyhrm8yLr23SSxce7YKxD6xhSASZCbkfpR

