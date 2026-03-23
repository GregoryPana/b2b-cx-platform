--
-- PostgreSQL database dump
--

\restrict 8xa8OVovGsFeKh887uRDDzXKXO0UugRHXKSbmWlChEpC8XxytryPGdja4FNBD4d

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg13+1)

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

--
-- Data for Name: account_executives; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account_executives (id, name, email) FROM stdin;
1	Alex Executive	alex.executive@local
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
20260227_000009
\.


--
-- Data for Name: programs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.programs (code, name, description, is_active, id, created_at, updated_at) FROM stdin;
B2B	B2B CX Program	Business-to-Business Customer Experience Assessment	t	22	2026-03-03 11:14:12.569376+00	2026-03-03 11:14:12.569376+00
B2C	B2C CX Program	Business-to-Consumer Customer Experience Assessment	t	23	2026-03-03 11:14:12.569833+00	2026-03-03 11:14:12.569833+00
INSTALL	Installation CX Program	Installation and Service Customer Experience Assessment	t	24	2026-03-03 11:14:12.57106+00	2026-03-03 11:14:12.57106+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, role, active, created_at) FROM stdin;
1	Admin	admin@local	Admin	t	2026-02-25 10:21:56.153304+00
2	Reviewer	reviewer@local	Reviewer	t	2026-02-25 10:21:56.153304+00
3	Manager	manager@local	Manager	t	2026-02-25 10:21:56.153304+00
4	Representative	rep@local	Representative	t	2026-02-25 10:21:56.153304+00
5	John Smith	john.smith@company.com	Representative	t	2026-03-04 05:27:56.797602+00
6	Sarah Johnson	sarah.johnson@company.com	Representative	t	2026-03-04 05:27:56.797602+00
7	Michael Davis	michael.davis@company.com	Representative	t	2026-03-04 05:27:56.797602+00
8	Emily Wilson	emily.wilson@company.com	Representative	t	2026-03-04 05:27:56.797602+00
9	David Brown	david.brown@company.com	Representative	t	2026-03-04 05:27:56.797602+00
10	Lisa Anderson	lisa.anderson@company.com	Representative	t	2026-03-04 05:27:56.797602+00
11	Robert Taylor	robert.taylor@company.com	Representative	t	2026-03-04 05:27:56.797602+00
12	Jennifer Martinez	jennifer.martinez@company.com	Representative	t	2026-03-04 05:27:56.797602+00
13	William Garcia	william.garcia@company.com	Representative	t	2026-03-04 05:27:56.797602+00
14	Maria Rodriguez	maria.rodriguez@company.com	Representative	t	2026-03-04 05:27:56.797602+00
\.


--
-- Data for Name: assessment_instances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assessment_instances (program_id, template_version, respondent_id, context_id, context_type, title, completed_at, status, submitted_by, approved_by, approved_at, id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: assessment_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assessment_templates (program_id, name, description, version, is_active, created_by, id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, entity_type, entity_id, action, modified_by, "timestamp") FROM stdin;
\.


--
-- Data for Name: survey_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.survey_types (id, name, description, created_at, updated_at) FROM stdin;
1	B2B	B2B Customer Experience Survey	2026-03-05 06:11:46.042784+00	2026-03-05 06:11:46.042784+00
2	Mystery Shopper	Mystery Shopper Survey	2026-03-05 06:11:46.042784+00	2026-03-05 06:11:46.042784+00
3	Installation Assessment	Installation Assessment Survey	2026-03-05 06:11:46.042784+00	2026-03-05 06:11:46.042784+00
\.


--
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.questions (id, survey_type_id, question_number, question_text, category, is_mandatory, is_nps, input_type, score_min, score_max, choices, helper_text, requires_issue, requires_escalation, question_key, created_at, updated_at) FROM stdin;
1	1	1	Rate your relationship with C&W.	Category 1: Relationship Strength	t	f	score	0	10	\N	\N	f	f	q01_relationship_strength	2026-03-05 06:11:46.042784+00	2026-03-09 07:18:06.881827+00
7	1	7	List your top 3 C&W services most satisfied with in the past 6 months.	Category 2: Service & Operational Performance	t	f	text	\N	\N	\N	\N	f	f	q07_top_3_satisfied_services	2026-03-05 06:11:46.042784+00	2026-03-09 07:18:06.881827+00
8	1	8	List 3 instances you have not been satisfied with C&W if any (Network Quality, Fault resolution, Visits, billing etc) if any be specific..	Category 2: Service & Operational Performance	f	f	text	\N	\N	\N	\N	f	f	q08_top_3_unsatisfied_instances	2026-03-05 06:11:46.042784+00	2026-03-09 07:18:06.881827+00
9	1	9	Are Issues resolved on time?	Category 2: Service & Operational Performance	t	f	always_sometimes_never	\N	\N	["Always", "Sometimes", "Never"]	Choose: Always, Sometimes, or Never	f	f	q09_issues_resolved_on_time	2026-03-05 06:11:46.042784+00	2026-03-09 07:18:06.881827+00
10	1	10	How often do you need to call C&W to install new products or resolve issues?	Category 2: Service & Operational Performance	t	f	always_sometimes_never	\N	\N	["Always", "Sometimes", "Never"]	Choose: Always, Sometimes, or Never	f	f	q10_call_frequency	2026-03-05 06:11:46.042784+00	2026-03-09 07:18:06.881827+00
12	1	12	Rate your overall C&W Satisfaction.	Category 2: Service & Operational Performance	t	f	score	0	10	\N	\N	f	f	q12_overall_satisfaction	2026-03-05 06:11:46.042784+00	2026-03-09 07:31:50.491475+00
2	1	2	Do you get enough information from your Account Executive on New Products and Services?	Category 1: Relationship Strength	t	f	score	0	10	\N	\N	f	f	q02_ae_information_updates	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.317503+00
3	1	3	How would you rate the level of professionalism when dealing with your C&W Account Executive?	Category 1: Relationship Strength	t	f	score	0	10	\N	\N	f	f	q03_ae_professionalism	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.322483+00
4	1	4	Does the C&W Account Executive understand your business?	Category 1: Relationship Strength	t	f	yes_no	\N	\N	["Yes", "No"]	Select Yes or No	f	f	q04_ae_business_understanding	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.324991+00
5	1	5	How satisfied are you with your C&W contacts and number of visits?	Category 1: Relationship Strength	t	f	score	0	10	\N	\N	f	f	q05_contacts_visit_satisfaction	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.327719+00
6	1	6	Are you receiving regular updates on your account? (Y or N)	Category 1: Relationship Strength	t	f	yes_no	\N	\N	["Yes", "No"]	Select Yes or No	f	f	q06_regular_updates	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.330191+00
11	1	11	What is your most recent unresolved issue with C&W?	Category 2: Service & Operational Performance	f	f	text	\N	\N	\N	\N	f	f	q11_recent_unresolved_issue	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.332448+00
13	1	13	What are the top 3 most important factors of our services? (e.g.Price, Quality, Credit, Information, Faults Resolution?)	Category 3: Commercial & Billing	t	f	text	\N	\N	\N	\N	f	f	q13_top_3_important_factors	2026-03-05 06:11:46.042784+00	2026-03-09 07:34:06.626618+00
16	1	16	Do you have other products and services from other service providers? (Yes or No)	Category 4: Competitive & Portfolio Intelligence	t	f	yes_no	\N	\N	["Yes", "No"]	Select Yes or No	f	f	q16_other_provider_products	2026-03-05 06:11:46.042784+00	2026-03-09 07:18:06.881827+00
17	1	17	If so, list Products and services from competitor. (Conditional on previous)	Category 4: Competitive & Portfolio Intelligence	t	f	text	\N	\N	\N	\N	f	f	q17_competitor_products_services	2026-03-05 06:11:46.042784+00	2026-03-09 07:18:06.881827+00
24	1	24	Any further comments from Customer.	Category 6: Advocacy	f	f	text	\N	\N	\N	\N	f	f	q24_comments	2026-03-05 06:11:46.042784+00	2026-03-09 07:18:06.881827+00
14	1	14	Is your statement of accounts accurate and up to date?	Category 3: Commercial & Billing	t	f	always_sometimes_never	\N	\N	["Always", "Sometimes", "Never"]	Choose: Always, Sometimes, or Never	f	f	q14_statement_accuracy	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.334469+00
15	1	15	What Products and Services do you currently have with C&W?	Category 4: Competitive & Portfolio Intelligence	t	f	text	\N	\N	\N	\N	f	f	q15_current_products_services	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.336477+00
18	1	18	Which product would you want us to review to bring you to CWS?	Category 4: Competitive & Portfolio Intelligence	t	f	text	\N	\N	\N	\N	f	f	q18_product_review_needed	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.338555+00
19	1	19	Do you have any new Telecommunications, or Digital Transformation requirements over next 6 to 12 months?	Category 5: Growth & Expansion	t	f	text	\N	\N	\N	\N	f	f	q19_new_requirements	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.34059+00
20	1	20	What kinds of expansions are you plannning for in the next 6-12 months?	Category 5: Growth & Expansion	t	f	text	\N	\N	\N	\N	f	f	q21_expansion_types	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.342867+00
21	1	21	What types of products and services are required for any expansion in 6 to 12 months?	Category 5: Growth & Expansion	t	f	text	\N	\N	\N	\N	f	f	q20_expansion_services_required	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.345252+00
22	1	22	What do you want to see more of from us?	Category 5: Growth & Expansion	t	f	text	\N	\N	\N	\N	f	f	q22_more_from_us	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.347336+00
23	1	23	NPS on a scale of 0 to 10, how much would you recommend us? (10 being very highly. 0 not at all)	Category 6: Advocacy	t	t	score	0	10	\N	\N	f	f	q23_nps	2026-03-05 06:11:46.042784+00	2026-03-09 07:33:15.349243+00
49	2	2001	How is Signage visibility & cleanliness	External Environment & First Impression	t	f	score	1	5	\N	\N	f	f	ms_signage_visibility_cleanliness	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
50	2	2002	How is Store entrance cleanliness	External Environment & First Impression	t	f	score	1	5	\N	\N	f	f	ms_store_entrance_cleanliness	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
51	2	2003	Rate the display of Promotional materials	External Environment & First Impression	t	f	score	1	5	\N	\N	f	f	ms_promotional_material_display	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
52	2	2004	Greeted within 30 seconds	External Environment & First Impression	t	f	yes_no	\N	\N	["Yes", "No"]	\N	f	f	ms_greeted_within_30_seconds	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
53	2	2005	Greeting polite & warm	External Environment & First Impression	t	f	yes_no	\N	\N	["Yes", "No"]	\N	f	f	ms_greeting_polite_warm	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
54	2	2006	Are staff Uniform neat and complete	Staff Appearance & Professionalism	t	f	score	1	5	\N	\N	f	f	ms_uniform_neat_complete	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
55	2	2007	How is the staff Personal grooming of	Staff Appearance & Professionalism	t	f	score	1	5	\N	\N	f	f	ms_personal_grooming	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
56	2	2008	Rate the Name badge visibility	Staff Appearance & Professionalism	t	f	score	1	5	\N	\N	f	f	ms_name_badge_visibility	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
57	2	2009	Do staff act with Professional behaviour	Staff Appearance & Professionalism	t	f	score	1	5	\N	\N	f	f	ms_professional_behaviour	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
58	2	2010	Did staff listen actively	Customer Service Interaction	t	f	yes_no	\N	\N	["Yes", "No"]	\N	f	f	ms_listened_actively	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
59	2	2011	Did staff Ask relevant questions	Customer Service Interaction	t	f	yes_no	\N	\N	["Yes", "No"]	\N	f	f	ms_asked_relevant_questions	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
60	2	2012	Rate Staff Product/service knowledge	Customer Service Interaction	t	f	score	1	5	\N	\N	f	f	ms_product_service_knowledge	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
61	2	2013	How was the Accuracy of information Provided	Customer Service Interaction	t	f	score	1	5	\N	\N	f	f	ms_information_accuracy	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
62	2	2014	Handled clarifying questions	Customer Service Interaction	t	f	score	1	5	\N	\N	f	f	ms_handled_clarifying_questions	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
63	2	2015	Was a Solution provided	Customer Service Interaction	t	f	yes_no	\N	\N	["Yes", "No"]	\N	f	f	ms_solution_provided	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
64	2	2016	Was the Solution helpful	Customer Service Interaction	t	f	yes_no	\N	\N	["Yes", "No"]	\N	f	f	ms_solution_helpful	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
65	2	2017	Cleanliness of store	Store Environment & Comfort	t	f	score	1	5	\N	\N	f	f	ms_store_cleanliness	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
66	2	2018	Queue management	Store Environment & Comfort	t	f	score	1	5	\N	\N	f	f	ms_queue_management	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
67	2	2019	Display organisation and posters	Store Environment & Comfort	t	f	score	1	5	\N	\N	f	f	ms_display_organization_posters	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
68	2	2020	Air conditioning / ventilation	Store Environment & Comfort	t	f	score	1	5	\N	\N	f	f	ms_aircon_ventilation	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
69	2	2021	Space & comfort	Store Environment & Comfort	t	f	score	1	5	\N	\N	f	f	ms_space_comfort	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
70	2	2022	Waiting time	Time & Efficiency	t	f	text	\N	\N	["Under 3 minutes", "3-7 minutes", "7-15 minutes", "15+ minutes"]	\N	f	f	ms_waiting_time	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
71	2	2023	Service completion (handling time)	Time & Efficiency	t	f	text	\N	\N	["Quick", "Acceptable", "Slow"]	\N	f	f	ms_service_completion_time	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
72	2	2024	Staff interaction satisfaction	Overall Experience (CSAT & NPS)	t	f	score	0	10	\N	\N	f	f	ms_staff_interaction_satisfaction	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
73	2	2025	Store environment satisfaction	Overall Experience (CSAT & NPS)	t	f	score	0	10	\N	\N	f	f	ms_store_environment_satisfaction	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
74	2	2026	NPS - Recommend this outlet	Overall Experience (CSAT & NPS)	t	t	score	0	10	\N	\N	f	f	ms_recommend_outlet_nps	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
75	2	2027	Final comments / recommendations	Overall Experience (CSAT & NPS)	f	f	text	\N	\N	\N	\N	f	f	ms_final_comments	2026-03-12 07:41:23.789883+00	2026-03-18 12:17:18.034049+00
\.


--
-- Data for Name: b2b_visit_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.b2b_visit_responses (id, visit_id, question_id, score, answer_text, verbatim, actions, created_at, updated_at) FROM stdin;
f8037980-5cd2-49ee-b558-e90391adfca6	51842412-b596-403c-8449-b2b53a634fa6	1	8	Sample answer text	Sample verbatim	[]	2026-03-05 06:11:46.241205+00	2026-03-05 06:11:46.241205+00
2af866ea-67b3-4f42-be8d-769447306f05	51842412-b596-403c-8449-b2b53a634fa6	2	8	Sample answer text	Sample verbatim	[]	2026-03-05 06:11:46.241205+00	2026-03-05 06:11:46.241205+00
3b14410e-c270-43da-be0b-8a54e69a5cfe	51842412-b596-403c-8449-b2b53a634fa6	3	8	Sample answer text	Sample verbatim	[]	2026-03-05 06:11:46.241205+00	2026-03-05 06:11:46.241205+00
207eb091-8937-40ed-854c-522b9939c4bb	51842412-b596-403c-8449-b2b53a634fa6	4	8	Sample answer text	Sample verbatim	[]	2026-03-05 06:11:46.241205+00	2026-03-05 06:11:46.241205+00
71fb2d34-4a87-4acf-9224-43b26e4f6472	51842412-b596-403c-8449-b2b53a634fa6	5	8	Sample answer text	Sample verbatim	[]	2026-03-05 06:11:46.241205+00	2026-03-05 06:11:46.241205+00
41b20cee-52cd-4c55-9460-e8353b49124f	92b46b3d-bff3-469a-a0b4-d91dee0f2fd8	1	8	Sample answer for question 1	Sample verbatim for question 1	[]	2026-03-05 07:43:03.612318+00	2026-03-05 07:43:03.612318+00
0d9e8a89-9819-448c-9be1-7932c0bef7ed	92b46b3d-bff3-469a-a0b4-d91dee0f2fd8	2	8	Sample answer for question 2	Sample verbatim for question 2	[]	2026-03-05 07:43:03.612318+00	2026-03-05 07:43:03.612318+00
44893ddd-3004-4bf1-a03e-3fecb3424237	92b46b3d-bff3-469a-a0b4-d91dee0f2fd8	3	8	Sample answer for question 3	Sample verbatim for question 3	[]	2026-03-05 07:43:03.612318+00	2026-03-05 07:43:03.612318+00
4b288924-b10e-4bda-8f6f-42215d0f5f40	c45d71d6-1e6b-4329-b475-8a3153caba9e	1	9	\N	\N	[]	2026-03-09 07:42:47.48784+00	2026-03-09 07:42:47.48784+00
d3356026-802f-4df7-9efa-6ed2c2e75acc	c45d71d6-1e6b-4329-b475-8a3153caba9e	3	6	\N	\N	[]	2026-03-09 07:43:08.663706+00	2026-03-09 07:43:08.663706+00
49fe5e1f-6455-4602-bbea-cb85cb93cbda	c45d71d6-1e6b-4329-b475-8a3153caba9e	2	5	\N	\N	[]	2026-03-09 07:42:55.697687+00	2026-03-09 07:45:28.832597+00
85f57957-e0ce-4db2-9765-64ebdddc5658	c45d71d6-1e6b-4329-b475-8a3153caba9e	4	\N	N	\N	[]	2026-03-09 07:45:33.316808+00	2026-03-09 07:45:33.316808+00
f0cc1d1b-c171-4305-becc-6d32c9f9020f	c45d71d6-1e6b-4329-b475-8a3153caba9e	5	3	\N	\N	[]	2026-03-09 07:45:38.976344+00	2026-03-09 07:45:38.976344+00
cf568e84-2a2b-4d88-a15f-e1dd19614d8f	c45d71d6-1e6b-4329-b475-8a3153caba9e	6	\N	N	\N	[]	2026-03-09 07:45:41.163948+00	2026-03-09 07:45:41.163948+00
c5d89749-bcff-4ddf-b1e7-ee806252c13f	c45d71d6-1e6b-4329-b475-8a3153caba9e	7	\N	Managed Wifi	\N	[]	2026-03-09 07:45:48.301437+00	2026-03-09 07:45:48.301437+00
ff9c2035-97cf-4b2a-a24b-ab1cf202d485	c45d71d6-1e6b-4329-b475-8a3153caba9e	8	\N	Fault Resolution\nInterruption Issues	\N	[]	2026-03-09 07:46:06.852108+00	2026-03-09 07:46:10.604921+00
04ecc922-683d-4bde-9474-558a24080973	c45d71d6-1e6b-4329-b475-8a3153caba9e	9	\N	Sometimes	\N	[]	2026-03-09 07:46:13.37702+00	2026-03-09 07:46:13.37702+00
3679acf7-092c-40fa-830f-6876b6f26deb	c45d71d6-1e6b-4329-b475-8a3153caba9e	10	\N	Sometimes	\N	[]	2026-03-09 07:46:14.784492+00	2026-03-09 07:46:14.784492+00
606a65f1-66bc-4a45-b450-080e5890d28d	c45d71d6-1e6b-4329-b475-8a3153caba9e	11	\N	Billing Issue	\N	[]	2026-03-09 07:46:22.709781+00	2026-03-09 07:46:22.709781+00
6c14abe0-0d3a-4116-a3ce-cd3f53a1127a	c45d71d6-1e6b-4329-b475-8a3153caba9e	12	6	\N	\N	[]	2026-03-09 07:46:26.233228+00	2026-03-09 07:46:26.233228+00
9e1983fa-96f4-4c36-bd26-d9d755665276	c45d71d6-1e6b-4329-b475-8a3153caba9e	13	\N	Price, Fault Resolution, Information availability	\N	[]	2026-03-09 07:46:44.858575+00	2026-03-09 07:46:44.858575+00
071a0319-78fa-43fa-a1fd-5d27314afe34	c45d71d6-1e6b-4329-b475-8a3153caba9e	14	\N	Sometimes	\N	[]	2026-03-09 07:46:47.907684+00	2026-03-09 07:46:47.907684+00
80d8d065-8ec6-4d02-9a60-7ee5ffb8bd7d	c45d71d6-1e6b-4329-b475-8a3153caba9e	15	\N	Managed Wifi\nUnlimited Broadband\nMobile Prepaid\nMobile Postpaid	\N	[]	2026-03-09 07:47:11.537281+00	2026-03-09 07:47:11.537281+00
3d7b0039-07c9-4e94-91b3-3f52bd50de92	c45d71d6-1e6b-4329-b475-8a3153caba9e	16	\N	N	\N	[]	2026-03-09 07:47:14.634892+00	2026-03-09 07:47:24.99035+00
ac5054c1-03ea-4579-98c8-39067f02a52b	c45d71d6-1e6b-4329-b475-8a3153caba9e	19	\N	Expansion	\N	[]	2026-03-09 07:47:36.933413+00	2026-03-09 07:47:36.933413+00
fb880db3-6158-4827-89e5-ab9f10ed0afe	c45d71d6-1e6b-4329-b475-8a3153caba9e	20	\N	Increased access points and upgrade speed	\N	[]	2026-03-09 07:48:01.18855+00	2026-03-09 07:48:01.18855+00
97729026-9fa1-4f12-9d43-c21a4017afd2	c45d71d6-1e6b-4329-b475-8a3153caba9e	21	\N	Increase network coverage area	\N	[]	2026-03-09 07:48:17.540715+00	2026-03-09 07:48:17.540715+00
c170e2e6-8c20-4df4-bb89-7564882f2f2c	c45d71d6-1e6b-4329-b475-8a3153caba9e	22	\N	More accessibility control options over managed wifi	\N	[]	2026-03-09 07:48:41.054298+00	2026-03-09 07:48:41.054298+00
c4b3e646-f665-4a4a-a663-a9079b4d819b	c45d71d6-1e6b-4329-b475-8a3153caba9e	23	5	\N	\N	[]	2026-03-09 07:48:54.162184+00	2026-03-09 07:48:54.162184+00
8743edec-441c-454a-981a-d35352f9afff	c45d71d6-1e6b-4329-b475-8a3153caba9e	24	\N	\N	\N	[]	2026-03-09 07:48:58.079463+00	2026-03-09 07:48:58.079463+00
6a85f8d5-e0ae-479e-9094-0c88f712bdce	c45d71d6-1e6b-4329-b475-8a3153caba9e	18	\N	Mesh Devices	\N	[]	2026-03-09 07:49:21.778488+00	2026-03-09 07:49:21.778488+00
51bba483-31c9-40bb-ae1a-ed065144913e	0e553a58-44fc-418f-8803-9505c1fc0d0f	1	8	\N	\N	[]	2026-03-09 10:35:19.956502+00	2026-03-09 10:35:19.956502+00
a3c20831-495f-4553-8d4b-7d4c1cc5a498	0e553a58-44fc-418f-8803-9505c1fc0d0f	2	5	\N	\N	[]	2026-03-09 10:35:28.011333+00	2026-03-09 10:35:28.011333+00
9edca70f-1857-4123-a220-383999f4d639	0e553a58-44fc-418f-8803-9505c1fc0d0f	3	7	\N	\N	[]	2026-03-09 10:35:32.616367+00	2026-03-09 10:35:32.616367+00
a22a31a9-cda0-477f-a5a5-46a29c13abd0	0e553a58-44fc-418f-8803-9505c1fc0d0f	4	\N	Y	\N	[]	2026-03-09 10:35:37.693804+00	2026-03-09 10:35:37.693804+00
61d1148e-fb20-41bd-8881-8cf8bfb0dcd0	0e553a58-44fc-418f-8803-9505c1fc0d0f	5	4	\N	\N	[]	2026-03-09 10:35:42.224102+00	2026-03-09 10:35:42.224102+00
122068ad-81bd-4057-96cf-256de3d29e2b	0e553a58-44fc-418f-8803-9505c1fc0d0f	6	\N	N	\N	[]	2026-03-09 10:35:46.71045+00	2026-03-09 10:35:46.71045+00
0e83d7e1-7ec5-4378-8810-58af54ee31fa	0e553a58-44fc-418f-8803-9505c1fc0d0f	7	\N	Managed Wifi\nUnlimited Broadband\nMobile Services	\N	[]	2026-03-09 10:36:04.290445+00	2026-03-09 10:36:04.290445+00
29b710c7-dfa6-407b-9a14-248e8fb11e8d	0e553a58-44fc-418f-8803-9505c1fc0d0f	8	\N	Network Quality\nFault Resolution Speed	\N	[]	2026-03-09 10:36:20.993148+00	2026-03-09 10:36:26.263614+00
652969d5-8e3f-4d2e-ba79-1f9c47071717	0e553a58-44fc-418f-8803-9505c1fc0d0f	9	\N	Sometimes	\N	[]	2026-03-09 10:36:32.942798+00	2026-03-09 10:36:32.942798+00
afbac6ac-c7bd-4792-abc0-ffa23f753815	0e553a58-44fc-418f-8803-9505c1fc0d0f	10	\N	Sometimes	\N	[]	2026-03-09 10:36:37.96685+00	2026-03-09 10:36:55.175273+00
4b622189-416a-4581-8855-59deacec3c9c	0e553a58-44fc-418f-8803-9505c1fc0d0f	11	\N	No ability to change password without calling	\N	[]	2026-03-09 10:36:57.50715+00	2026-03-09 10:36:57.50715+00
1c34d1cc-8e7d-4b57-9689-88b4611bcb9b	0e553a58-44fc-418f-8803-9505c1fc0d0f	12	7	\N	\N	[]	2026-03-09 10:37:06.697686+00	2026-03-09 10:37:06.697686+00
06a2137e-abd8-473d-a6f3-224c1bf78674	0e553a58-44fc-418f-8803-9505c1fc0d0f	13	\N	Price, Quality, Fault Resolution	\N	[]	2026-03-09 10:37:37.409902+00	2026-03-09 10:37:37.409902+00
bce85998-8b7c-43a0-b5fb-e7862bfbb1eb	0e553a58-44fc-418f-8803-9505c1fc0d0f	14	\N	Sometimes	\N	[]	2026-03-09 10:46:30.420114+00	2026-03-09 10:46:30.420114+00
6cf729ee-0beb-4736-aabc-728fcc1fc8d4	0e553a58-44fc-418f-8803-9505c1fc0d0f	15	\N	IPTV\nFiber Broadband\nMobile Services	\N	[]	2026-03-09 10:47:01.987797+00	2026-03-09 10:47:01.987797+00
1e1dc564-7d95-40dc-b745-37bd0c14dd41	0e553a58-44fc-418f-8803-9505c1fc0d0f	16	\N	N	\N	[]	2026-03-09 10:47:04.074951+00	2026-03-09 10:47:04.074951+00
b7e47f68-9565-435b-81fc-95737b89dada	0e553a58-44fc-418f-8803-9505c1fc0d0f	18	\N	Broadband Pricing and deals for gaming	\N	[]	2026-03-09 10:47:33.45363+00	2026-03-09 10:47:33.45363+00
b66fad49-2e87-4cb0-8a72-3fe47c493864	0e553a58-44fc-418f-8803-9505c1fc0d0f	19	\N	nope	\N	[]	2026-03-09 10:47:47.675002+00	2026-03-09 10:47:47.675002+00
852c1146-6a48-4928-a514-95a9090c7d27	0e553a58-44fc-418f-8803-9505c1fc0d0f	20	\N	none	\N	[]	2026-03-09 10:47:57.424267+00	2026-03-09 10:47:57.424267+00
968681fc-5fcd-4c15-9de2-b6560dcb2647	0e553a58-44fc-418f-8803-9505c1fc0d0f	21	\N	none	\N	[]	2026-03-09 10:48:01.641348+00	2026-03-09 10:48:01.641348+00
7442d9a4-6ab6-40ae-9e6f-6c2b463d3ab4	0e553a58-44fc-418f-8803-9505c1fc0d0f	22	\N	More packages or bundles	\N	[]	2026-03-09 10:48:16.819888+00	2026-03-09 10:48:16.819888+00
4fd3f063-735f-4852-bfdd-dddbb3f73e24	0e553a58-44fc-418f-8803-9505c1fc0d0f	23	9	\N	\N	[]	2026-03-09 10:48:29.573029+00	2026-03-09 10:48:29.573029+00
76718b7d-d1c6-43af-b32b-5670a60594c1	0e553a58-44fc-418f-8803-9505c1fc0d0f	24	\N	better speeds please	\N	[]	2026-03-09 10:48:45.427342+00	2026-03-09 10:48:45.427342+00
c4abfe06-8a6a-4186-b533-fcb9b5e59aef	b63a18df-ac1e-4151-928c-7d3dc6f348d8	1	6	\N	\N	[]	2026-03-10 05:47:41.838223+00	2026-03-10 05:47:41.838223+00
9e419ec4-6f1e-407e-94f6-b129ddab45d9	b63a18df-ac1e-4151-928c-7d3dc6f348d8	2	6	\N	\N	[]	2026-03-10 05:47:48.922838+00	2026-03-10 05:47:48.922838+00
70169cdc-8fd7-45f1-867a-a67106206bce	b63a18df-ac1e-4151-928c-7d3dc6f348d8	3	9	\N	\N	[]	2026-03-10 05:48:54.314814+00	2026-03-10 05:48:54.314814+00
2f54d6c2-f3ea-4af9-adf8-6625a16289b1	b63a18df-ac1e-4151-928c-7d3dc6f348d8	4	\N	Y	\N	[]	2026-03-10 05:49:15.746019+00	2026-03-10 05:49:15.746019+00
d43742f4-1e76-4b00-8036-bc857d7ed2ee	b63a18df-ac1e-4151-928c-7d3dc6f348d8	5	9	\N	\N	[]	2026-03-10 05:50:08.016032+00	2026-03-10 05:50:08.016032+00
750a9277-26e6-4e03-9d6e-17c511b14e1e	b63a18df-ac1e-4151-928c-7d3dc6f348d8	6	\N	Y	\N	[]	2026-03-10 05:50:14.391408+00	2026-03-10 05:50:14.391408+00
d89b8b54-7197-4db0-81d6-55afbbf95e97	b63a18df-ac1e-4151-928c-7d3dc6f348d8	7	\N	Fiber DIA, Guest WiFi, Managed Security	\N	[]	2026-03-10 05:50:30.648954+00	2026-03-10 05:50:30.648954+00
86781289-9f5f-4e65-88d2-56997efbdff8	b63a18df-ac1e-4151-928c-7d3dc6f348d8	8	\N	Packet loss during peak hours, billing credit delay, long escalation process	\N	[]	2026-03-10 05:52:15.256952+00	2026-03-10 05:52:15.256952+00
3897bccf-ed3e-487b-b289-dfa58deff8d9	b63a18df-ac1e-4151-928c-7d3dc6f348d8	9	\N	Never	\N	[]	2026-03-10 05:56:43.017969+00	2026-03-10 05:56:43.017969+00
52f6b8e4-d012-41e1-9944-10edf0378567	b63a18df-ac1e-4151-928c-7d3dc6f348d8	10	\N	Sometimes	\N	[]	2026-03-10 05:57:03.939874+00	2026-03-10 05:57:03.939874+00
fcca8d75-fb06-4e92-b405-581277818234	b63a18df-ac1e-4151-928c-7d3dc6f348d8	11	\N	None	\N	[]	2026-03-10 05:57:12.659617+00	2026-03-10 05:57:12.659617+00
a57e1761-743c-4627-a938-1224a588c42b	b63a18df-ac1e-4151-928c-7d3dc6f348d8	12	7	\N	\N	[]	2026-03-10 05:57:36.427133+00	2026-03-10 05:57:36.427133+00
ec667bbf-5c66-4db5-87b1-a427272d8ea0	b63a18df-ac1e-4151-928c-7d3dc6f348d8	13	\N	Price, Quality, Credit	\N	[]	2026-03-10 05:57:47.1562+00	2026-03-10 05:57:47.1562+00
a8546bf6-086f-4d95-b169-7333aab480a6	b63a18df-ac1e-4151-928c-7d3dc6f348d8	14	\N	Never	\N	[]	2026-03-10 05:57:52.093926+00	2026-03-10 05:57:52.093926+00
fec9bb1c-f9ba-4fb8-84b4-f4a5d99ffb8e	b63a18df-ac1e-4151-928c-7d3dc6f348d8	15	\N	MPLS, Dedicated Internet, SIP Trunks	\N	[]	2026-03-10 05:58:02.330787+00	2026-03-10 05:58:02.330787+00
eac11d5d-ebba-435e-bead-1f6f68e0cf05	b63a18df-ac1e-4151-928c-7d3dc6f348d8	16	\N	Y	\N	[]	2026-03-10 05:58:12.388117+00	2026-03-10 05:58:12.388117+00
7e8f42cc-1c7b-4704-be3c-a5cd387c2f74	b63a18df-ac1e-4151-928c-7d3dc6f348d8	17	\N	Satellite Backup Provider	\N	[]	2026-03-10 05:58:28.131834+00	2026-03-10 05:58:28.131834+00
11b1c5f0-17e6-4ea4-8c8b-362d74e52190	b63a18df-ac1e-4151-928c-7d3dc6f348d8	18	\N	Review backup connectivity pricing	\N	[]	2026-03-10 05:58:41.191658+00	2026-03-10 05:58:41.191658+00
3314d990-5601-4c09-bf01-1d7dcdd5791f	b63a18df-ac1e-4151-928c-7d3dc6f348d8	19	\N	Hotel renovation and digital upgrade	\N	[]	2026-03-10 05:58:51.724829+00	2026-03-10 05:58:51.724829+00
89918367-e324-484e-b74e-47972b7f0a5f	b63a18df-ac1e-4151-928c-7d3dc6f348d8	20	\N	Warehouse expansion	\N	[]	2026-03-10 05:59:00.768074+00	2026-03-10 05:59:00.768074+00
e2b45bf9-15dc-4e28-9df4-c88e84ee5877	b63a18df-ac1e-4151-928c-7d3dc6f348d8	21	\N	SD-WAN, increased bandwidth, managed firewall	\N	[]	2026-03-10 05:59:08.205936+00	2026-03-10 05:59:08.205936+00
42594ff1-19f4-44e4-8f08-328800bea6e8	b63a18df-ac1e-4151-928c-7d3dc6f348d8	22	\N	More proactive communication during outages	\N	[]	2026-03-10 05:59:25.905694+00	2026-03-10 05:59:25.905694+00
437ea649-aae0-4281-bd94-8445f57087be	b63a18df-ac1e-4151-928c-7d3dc6f348d8	23	6	\N	\N	[]	2026-03-10 05:59:33.7801+00	2026-03-10 05:59:33.7801+00
109f7833-7f1d-46fc-bee6-9695c06a27a9	b63a18df-ac1e-4151-928c-7d3dc6f348d8	24	\N	Service overall reliable but improvements in response time would help.	\N	[]	2026-03-10 05:59:51.036878+00	2026-03-10 05:59:51.036878+00
af8caf0f-79b1-43aa-b1c5-c3f3872e88dd	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	1	6	\N	\N	[]	2026-03-10 06:12:13.010199+00	2026-03-10 06:12:13.010199+00
69247711-af31-458c-9a42-34d90e77c8c1	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	2	7	\N	\N	[]	2026-03-10 06:13:16.566265+00	2026-03-10 06:13:16.566265+00
3fd23851-0529-4642-8e8a-f84b51137ace	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	3	6	\N	\N	[]	2026-03-10 06:13:20.987041+00	2026-03-10 06:13:20.987041+00
884ba2dc-325c-4e79-b733-788804a5c040	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	4	\N	Y	\N	[]	2026-03-10 06:13:26.248226+00	2026-03-10 06:13:26.248226+00
75a7f7ac-a930-473c-83cc-cdbc8b0a5851	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	5	8	\N	\N	[]	2026-03-10 06:13:31.872795+00	2026-03-10 06:13:31.872795+00
c6a14670-8021-4869-a2ce-dfa257576076	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	6	\N	Y	\N	[]	2026-03-10 06:13:42.055672+00	2026-03-10 06:13:42.055672+00
6c603e3e-cb62-4730-b2ae-af9ff7f95c42	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	7	\N	Fiber DIA, Guest WiFi, Managed Security	\N	[]	2026-03-10 06:13:51.556327+00	2026-03-10 06:13:51.556327+00
769aa351-b120-4758-9c93-83398918b722	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	8	\N	Billing clarification delay, slow technician visit, intermittent connectivity	\N	[]	2026-03-10 06:14:01.361052+00	2026-03-10 06:14:01.361052+00
1ef75896-8fca-498e-9327-3fde8bdbfe82	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	9	\N	Never	\N	[]	2026-03-10 06:14:06.493845+00	2026-03-10 06:14:06.493845+00
34643244-dd79-436d-8ae4-2290f753832c	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	10	\N	Sometimes	\N	[]	2026-03-10 06:14:16.827473+00	2026-03-10 06:14:16.827473+00
935e2d6d-610e-4dfd-a1bc-22b098eb02f3	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	11	\N	none	\N	[]	2026-03-10 06:14:21.872928+00	2026-03-10 06:14:21.872928+00
8f35087f-1790-4dc0-b207-513e73bdfff8	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	12	9	\N	\N	[]	2026-03-10 06:14:31.193661+00	2026-03-10 06:14:31.193661+00
931a6d1f-3c94-4945-b599-ffdc7a9f8c39	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	13	\N	Reliability, Fault Resolution, Support	\N	[]	2026-03-10 06:14:43.584978+00	2026-03-10 06:14:43.584978+00
f7dc9f0f-1976-4a15-8e62-b1b63f69bdb4	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	14	\N	Sometimes	\N	[]	2026-03-10 06:14:53.641126+00	2026-03-10 06:14:53.641126+00
3b0cf47f-a91d-43fd-81c6-88a1b8b12447	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	15	\N	Fiber DIA, Cloud Connect	\N	[]	2026-03-10 06:15:06.542698+00	2026-03-10 06:15:06.542698+00
27224407-ff2f-455c-ab90-77eb7461872f	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	16	\N	N	\N	[]	2026-03-10 06:15:12.094977+00	2026-03-10 06:15:12.094977+00
01dcd8ae-3c0e-49df-98b5-521fcd530aa0	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	18	\N	Review backup connectivity pricing	\N	[]	2026-03-10 06:15:44.460928+00	2026-03-10 06:15:44.460928+00
71a9f4d9-c9ab-4a03-a23c-d913414106c7	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	19	\N	Opening new branch office	\N	[]	2026-03-10 06:15:59.380834+00	2026-03-10 06:15:59.380834+00
446e228e-ec4f-4f15-9aca-1239342ee40e	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	20	\N	Opening new branch office	\N	[]	2026-03-10 06:16:10.426543+00	2026-03-10 06:16:10.426543+00
e6572652-6d60-4482-aad2-eb464fe95b68	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	21	\N	Fiber upgrade and redundancy	\N	[]	2026-03-10 06:16:48.354907+00	2026-03-10 06:16:48.354907+00
1b67c29c-17dd-4c21-af11-d219423e6182	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	22	\N	Faster fault response times	\N	[]	2026-03-10 06:17:09.132588+00	2026-03-10 06:17:09.132588+00
4aecf737-d19f-4633-98c7-a601a9c1409a	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	23	9	\N	\N	[]	2026-03-10 06:17:15.017289+00	2026-03-10 06:17:15.017289+00
74b757d4-0dd9-4b15-a09a-9a2cebb3a245	1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	24	\N	Service overall reliable but improvements in response time would help.	\N	[]	2026-03-10 06:17:24.37588+00	2026-03-10 06:17:24.37588+00
ba88b9b7-7477-4a95-b7a3-b00d9d3a2157	038e2140-a6ad-4320-9092-c04e6249cbd4	1	9	\N	\N	[]	2026-03-10 06:25:43.685216+00	2026-03-10 06:25:43.685216+00
b2b82255-b72f-49f0-9490-794ba84f3adc	038e2140-a6ad-4320-9092-c04e6249cbd4	2	9	\N	\N	[]	2026-03-10 06:25:49.409785+00	2026-03-10 06:25:49.409785+00
723a4373-b6ef-4bfc-9ab5-0bc7478e220a	038e2140-a6ad-4320-9092-c04e6249cbd4	3	10	\N	\N	[]	2026-03-10 06:25:58.590401+00	2026-03-10 06:25:58.590401+00
5222328c-f7d0-42d4-bbdd-ce7c1c17e172	038e2140-a6ad-4320-9092-c04e6249cbd4	4	\N	Y	\N	[]	2026-03-10 06:26:04.783358+00	2026-03-10 06:26:04.783358+00
0d326d8a-40b2-45d5-9a3d-0f462f412c84	038e2140-a6ad-4320-9092-c04e6249cbd4	5	8	\N	\N	[]	2026-03-10 06:26:11.082656+00	2026-03-10 06:26:11.082656+00
6a301fa3-00bf-40d7-939d-35b5ea541527	038e2140-a6ad-4320-9092-c04e6249cbd4	6	\N	N	\N	[]	2026-03-10 06:26:18.356334+00	2026-03-10 06:26:18.356334+00
f5595d4d-bad2-4164-8a38-9ae9f823eb85	038e2140-a6ad-4320-9092-c04e6249cbd4	7	\N	Business Broadband, LTE Backup, Hosted Voice	\N	[]	2026-03-10 06:28:28.944635+00	2026-03-10 06:28:28.944635+00
414f38a1-fbec-4dd6-ad9c-75a04b90318a	038e2140-a6ad-4320-9092-c04e6249cbd4	8	\N	Fiber outage at office location, delayed fault resolution, missed site visit	\N	[]	2026-03-10 06:28:42.243741+00	2026-03-10 06:28:42.243741+00
3ca12963-7ecb-454e-ad1a-7e58e1cd8b82	038e2140-a6ad-4320-9092-c04e6249cbd4	9	\N	Always	\N	[]	2026-03-10 06:28:47.033279+00	2026-03-10 06:28:47.033279+00
b2fe8b57-b4ad-48eb-babf-2215653585a8	038e2140-a6ad-4320-9092-c04e6249cbd4	10	\N	Always	\N	[]	2026-03-10 06:28:53.438678+00	2026-03-10 06:28:53.438678+00
635a6372-5ee0-417b-9734-09116d1c3bdc	038e2140-a6ad-4320-9092-c04e6249cbd4	11	\N	Pending billing credit for recent outage	\N	[]	2026-03-10 06:29:35.569097+00	2026-03-10 06:29:35.569097+00
0baaa1bb-ea69-46a9-99c5-41066137a0d7	038e2140-a6ad-4320-9092-c04e6249cbd4	12	7	\N	\N	[]	2026-03-10 06:29:42.596691+00	2026-03-10 06:29:42.596691+00
ba6b5344-6749-498a-93ce-e88d50b756b1	038e2140-a6ad-4320-9092-c04e6249cbd4	13	\N	Reliability, Fault Resolution, Support	\N	[]	2026-03-10 06:30:01.058191+00	2026-03-10 06:30:01.058191+00
46e99671-e437-4e4c-83cf-f9ef8cb9eb74	038e2140-a6ad-4320-9092-c04e6249cbd4	14	\N	Never	\N	[]	2026-03-10 06:30:04.518577+00	2026-03-10 06:30:04.518577+00
50a04295-693a-44d5-8596-010561753054	038e2140-a6ad-4320-9092-c04e6249cbd4	15	\N	MPLS, Dedicated Internet, SIP Trunks	\N	[]	2026-03-10 06:30:17.896361+00	2026-03-10 06:30:17.896361+00
71d28ca1-49c6-49ab-91df-a28f4b1abcbe	038e2140-a6ad-4320-9092-c04e6249cbd4	16	\N	Y	\N	[]	2026-03-10 06:30:27.557256+00	2026-03-10 06:30:27.557256+00
6e911907-fe42-49fb-b7e3-eb6ec1875083	038e2140-a6ad-4320-9092-c04e6249cbd4	17	\N	Satellite Backup Provider	\N	[]	2026-03-10 06:30:39.769397+00	2026-03-10 06:30:39.769397+00
0756ccd2-795b-4cfe-91fa-e07e6d7a3f20	038e2140-a6ad-4320-9092-c04e6249cbd4	18	\N	Review backup connectivity pricing	\N	[]	2026-03-10 06:31:17.277151+00	2026-03-10 06:31:17.277151+00
3bf1898e-4918-4f5c-94d4-40b652f80f5d	038e2140-a6ad-4320-9092-c04e6249cbd4	19	\N	Warehouse expansion	\N	[]	2026-03-10 06:31:30.288655+00	2026-03-10 06:31:30.288655+00
d5b00c36-a04c-45f1-a878-422a1db73ba5	038e2140-a6ad-4320-9092-c04e6249cbd4	20	\N	Cloud migration for internal systems	\N	[]	2026-03-10 06:31:40.170671+00	2026-03-10 06:31:40.170671+00
cbcff5d3-7dde-47c9-812b-a151d1b94b66	038e2140-a6ad-4320-9092-c04e6249cbd4	21	\N	Fiber upgrade and redundancy	\N	[]	2026-03-10 06:32:37.223583+00	2026-03-10 06:32:37.223583+00
08f8f740-8544-424a-aa66-0d809c956261	038e2140-a6ad-4320-9092-c04e6249cbd4	22	\N	Technical workshops for new services	\N	[]	2026-03-10 06:32:51.885014+00	2026-03-10 06:32:51.885014+00
5140cdf0-8e3c-444a-b209-6f45d752ff53	038e2140-a6ad-4320-9092-c04e6249cbd4	23	7	\N	\N	[]	2026-03-10 06:32:57.576848+00	2026-03-10 06:32:57.576848+00
a0054190-c155-47fa-b9f7-709bb0ae3adc	038e2140-a6ad-4320-9092-c04e6249cbd4	24	\N	Service overall reliable but improvements in response time would help.	\N	[]	2026-03-10 06:33:12.840415+00	2026-03-10 06:33:12.840415+00
769f6a30-cb18-4acb-97c1-ae328fb2a16e	a19f5e3d-eddc-41de-b278-dcbd078e98da	1	8	\N	\N	[]	2026-03-10 07:39:10.956283+00	2026-03-10 07:39:10.956283+00
deb6b9a3-b335-43ee-b1c8-362e42f24e90	a19f5e3d-eddc-41de-b278-dcbd078e98da	2	9	\N	\N	[]	2026-03-10 07:39:22.855587+00	2026-03-10 07:39:22.855587+00
c9a852c7-930e-4b67-b1ad-5e625823dda6	a19f5e3d-eddc-41de-b278-dcbd078e98da	3	9	\N	\N	[]	2026-03-10 07:39:33.036946+00	2026-03-10 07:39:33.036946+00
e8b2dd0e-6e27-4597-bae8-20c167a5e80a	a19f5e3d-eddc-41de-b278-dcbd078e98da	4	\N	Y	\N	[]	2026-03-10 07:39:38.724246+00	2026-03-10 07:39:38.724246+00
0e24dbdc-73d0-415e-990e-64c77026d4bc	a19f5e3d-eddc-41de-b278-dcbd078e98da	5	8	\N	\N	[]	2026-03-10 07:41:41.503417+00	2026-03-10 07:41:41.503417+00
82290d00-449e-4b6a-8e28-2c3a6f617a1e	a19f5e3d-eddc-41de-b278-dcbd078e98da	6	\N	Y	\N	[]	2026-03-10 07:41:46.077267+00	2026-03-10 07:41:46.077267+00
55f84599-2bb6-4bef-878d-0012fe28fd91	a19f5e3d-eddc-41de-b278-dcbd078e98da	7	\N	Fiber Internet, MPLS, SIP Trunks	\N	[]	2026-03-10 07:41:56.459524+00	2026-03-10 07:41:56.459524+00
397daa59-ab91-447a-9340-71557952d5fd	a19f5e3d-eddc-41de-b278-dcbd078e98da	8	\N	Packet loss during peak hours, billing credit delay, long escalation process	\N	[]	2026-03-10 07:42:08.465403+00	2026-03-10 07:42:08.465403+00
d1378904-c63b-4a13-b142-9649ec0493ec	a19f5e3d-eddc-41de-b278-dcbd078e98da	9	\N	Never	\N	[]	2026-03-10 07:42:13.727958+00	2026-03-10 07:42:13.727958+00
95375475-7714-41ed-b877-e5d5e08b6190	a19f5e3d-eddc-41de-b278-dcbd078e98da	10	\N	Always	\N	[]	2026-03-10 07:42:29.826389+00	2026-03-10 07:42:29.826389+00
a75abc2c-64a5-4def-b49e-89c796a5fce9	a19f5e3d-eddc-41de-b278-dcbd078e98da	11	\N	Pending billing credit for recent outage	\N	[]	2026-03-10 07:42:45.728684+00	2026-03-10 07:42:45.728684+00
0674ccfc-484c-487d-9b43-f62e54ce9679	a19f5e3d-eddc-41de-b278-dcbd078e98da	12	7	\N	\N	[]	2026-03-10 07:42:51.003827+00	2026-03-10 07:42:51.003827+00
f6197b52-164a-4c1a-b6c6-c67464ab2f1e	a19f5e3d-eddc-41de-b278-dcbd078e98da	13	\N	Quality, Price, Information	\N	[]	2026-03-10 07:43:01.508565+00	2026-03-10 07:43:01.508565+00
fc01e3cb-0c78-4d10-9568-561b31aaa503	a19f5e3d-eddc-41de-b278-dcbd078e98da	14	\N	Never	\N	[]	2026-03-10 07:43:11.352375+00	2026-03-10 07:43:11.352375+00
fa88057d-3489-4864-b774-30059e6ca733	a19f5e3d-eddc-41de-b278-dcbd078e98da	15	\N	Business Broadband, LTE Backup	\N	[]	2026-03-10 07:44:29.389054+00	2026-03-10 07:44:29.389054+00
7c7918a2-5592-45e1-8517-852eca25d5dd	a19f5e3d-eddc-41de-b278-dcbd078e98da	16	\N	Y	\N	[]	2026-03-10 07:44:35.249521+00	2026-03-10 07:44:35.249521+00
f04f7642-fe62-47e5-a373-df01be21f95e	a19f5e3d-eddc-41de-b278-dcbd078e98da	17	\N	Satellite Backup Provider	\N	[]	2026-03-10 07:45:55.414437+00	2026-03-10 07:45:55.414437+00
f2512b80-a1d7-45f4-a4e8-732bb23e274d	a19f5e3d-eddc-41de-b278-dcbd078e98da	18	\N	Review backup connectivity pricing	\N	[]	2026-03-10 07:46:09.524193+00	2026-03-10 07:46:09.524193+00
04330a50-e3e1-4d8f-ac6a-b1753cc8b481	a19f5e3d-eddc-41de-b278-dcbd078e98da	19	\N	Upgrade connectivity across offices	\N	[]	2026-03-10 07:46:36.696119+00	2026-03-10 07:46:36.696119+00
24d65e2f-c777-4a38-b554-06960eadf7e5	a19f5e3d-eddc-41de-b278-dcbd078e98da	20	\N	Upgrade connectivity across offices	\N	[]	2026-03-10 07:46:48.136408+00	2026-03-10 07:46:48.136408+00
bc02ec85-a095-441a-b000-64cd4e72496a	a19f5e3d-eddc-41de-b278-dcbd078e98da	21	\N	Fiber upgrade and redundancy	\N	[]	2026-03-10 07:46:57.64951+00	2026-03-10 07:46:57.64951+00
c15448c5-409e-4508-81a8-d45966731df2	a19f5e3d-eddc-41de-b278-dcbd078e98da	22	\N	More proactive communication during outages	\N	[]	2026-03-10 07:47:10.424453+00	2026-03-10 07:47:10.424453+00
56c5c4fb-ccaa-4248-8c37-3e731a52ae51	a19f5e3d-eddc-41de-b278-dcbd078e98da	23	6	\N	\N	[]	2026-03-10 07:47:15.05363+00	2026-03-10 07:47:15.05363+00
1b139c4e-dd02-44cf-be66-00a9af50ea28	a19f5e3d-eddc-41de-b278-dcbd078e98da	24	\N	Service overall reliable but improvements in response time would help.	\N	[]	2026-03-10 07:47:30.692199+00	2026-03-10 07:47:30.692199+00
ada6f84d-8f16-4439-8e7b-65886e020747	1ebf18ab-278e-473d-ad49-a7e9cbf92691	1	7	\N	\N	[]	2026-03-11 05:59:03.321327+00	2026-03-11 05:59:03.321327+00
348f8dff-5ada-4714-afb5-48d9bb8bd860	dc527422-fa4d-49c5-80cd-8a2d772c23a3	23	0	\N	\N	[]	2026-03-11 06:31:50.701961+00	2026-03-11 06:31:50.701961+00
711475eb-37fc-4261-bf43-ba0910115b91	1ebf18ab-278e-473d-ad49-a7e9cbf92691	2	8	\N	\N	[]	2026-03-11 05:59:27.732283+00	2026-03-11 05:59:39.547159+00
b0ab9950-5443-4550-8583-78f9ab9388c6	1ebf18ab-278e-473d-ad49-a7e9cbf92691	3	9	\N	\N	[]	2026-03-11 05:59:50.909181+00	2026-03-11 05:59:50.909181+00
fbbc0391-5821-4d9b-9985-83b90ca643c4	1ebf18ab-278e-473d-ad49-a7e9cbf92691	4	\N	N	\N	[]	2026-03-11 06:00:14.374569+00	2026-03-11 06:00:14.374569+00
1f07f9f7-9136-4ecc-8785-9c2381c1c071	1ebf18ab-278e-473d-ad49-a7e9cbf92691	5	9	\N	\N	[]	2026-03-11 06:00:24.294821+00	2026-03-11 06:00:24.294821+00
2cb19d21-be4d-4bb3-9d6f-92e2bde62dfd	1ebf18ab-278e-473d-ad49-a7e9cbf92691	6	\N	Y	\N	[]	2026-03-11 06:00:30.741862+00	2026-03-11 06:00:30.741862+00
68ac1731-c1fe-4a20-b02f-69b5b369da77	1ebf18ab-278e-473d-ad49-a7e9cbf92691	7	\N	Dedicated Internet, MPLS, Managed Firewall	\N	[]	2026-03-11 06:00:43.848166+00	2026-03-11 06:00:43.848166+00
ce39e026-bc37-4a5b-b80d-eb94cbb56d34	1ebf18ab-278e-473d-ad49-a7e9cbf92691	8	\N	Packet loss during peak hours, billing credit delay, long escalation process	\N	[]	2026-03-11 06:02:28.263989+00	2026-03-11 06:02:28.263989+00
7a0865bb-2e6e-4675-9e1d-a081f87f6cbc	1ebf18ab-278e-473d-ad49-a7e9cbf92691	9	\N	Always	\N	[]	2026-03-11 06:02:52.173947+00	2026-03-11 06:02:52.173947+00
6f21f8e8-213f-4db6-bdd9-8fc174605b5a	1ebf18ab-278e-473d-ad49-a7e9cbf92691	10	\N	Never	\N	[]	2026-03-11 06:02:57.915481+00	2026-03-11 06:02:57.915481+00
f3ed71ab-d75d-4743-9c40-dc0a69a8e5f5	1ebf18ab-278e-473d-ad49-a7e9cbf92691	11	\N	Pending billing credit for recent outage	\N	[]	2026-03-11 06:03:09.393099+00	2026-03-11 06:03:09.393099+00
58b0f13f-0d5c-461b-83c5-e9c88c5802e4	1ebf18ab-278e-473d-ad49-a7e9cbf92691	12	7	\N	\N	[]	2026-03-11 06:03:18.641157+00	2026-03-11 06:03:18.641157+00
e26b57ca-7483-4979-b54f-ce141c4cf1d7	1ebf18ab-278e-473d-ad49-a7e9cbf92691	13	\N	Price, Quality, Credit	\N	[]	2026-03-11 06:03:32.636456+00	2026-03-11 06:03:32.636456+00
291e7541-60a6-4145-9593-4d7c862b5978	1ebf18ab-278e-473d-ad49-a7e9cbf92691	14	\N	Sometimes	\N	[]	2026-03-11 06:03:37.46366+00	2026-03-11 06:03:37.46366+00
d17e54d0-9ddb-46ae-b3a6-e121de44a8a8	1ebf18ab-278e-473d-ad49-a7e9cbf92691	15	\N	Fiber Internet, Managed Firewall, VPN	\N	[]	2026-03-11 06:04:07.556116+00	2026-03-11 06:04:07.556116+00
4aa9fceb-989c-41a0-bf63-8fed7da1ef9c	1ebf18ab-278e-473d-ad49-a7e9cbf92691	16	\N	Y	\N	[]	2026-03-11 06:06:57.447554+00	2026-03-11 06:06:57.447554+00
0cbe4a91-6777-4976-8f35-22642e2f6533	1ebf18ab-278e-473d-ad49-a7e9cbf92691	17	\N	Airtel Business LTE	\N	[]	2026-03-11 06:07:12.947101+00	2026-03-11 06:07:12.947101+00
d57dfb6d-94c6-49aa-9925-673578e8940d	1ebf18ab-278e-473d-ad49-a7e9cbf92691	18	\N	Review backup connectivity pricing	\N	[]	2026-03-11 06:07:41.820908+00	2026-03-11 06:07:41.820908+00
d4c707ea-fe41-4ef7-a204-2ebcc95a5939	1ebf18ab-278e-473d-ad49-a7e9cbf92691	19	\N	Warehouse expansion	\N	[]	2026-03-11 06:07:59.265061+00	2026-03-11 06:07:59.265061+00
f8623b6d-91ef-4233-8f32-4840f0f6ac41	1ebf18ab-278e-473d-ad49-a7e9cbf92691	20	\N	Hotel renovation and digital upgrade	\N	[]	2026-03-11 06:08:11.012866+00	2026-03-11 06:08:11.012866+00
4fdc2202-0beb-4d20-9611-d7a4e0c57622	1ebf18ab-278e-473d-ad49-a7e9cbf92691	21	\N	SD-WAN, increased bandwidth, managed firewall	\N	[]	2026-03-11 06:09:16.354154+00	2026-03-11 06:09:16.354154+00
55d90bc1-2b6e-4988-8f55-ec8fc649f126	1ebf18ab-278e-473d-ad49-a7e9cbf92691	22	\N	More regular account updates	\N	[]	2026-03-11 06:09:30.009316+00	2026-03-11 06:09:30.009316+00
1f758345-a807-45e5-8585-71da9ac14c59	1ebf18ab-278e-473d-ad49-a7e9cbf92691	23	6	\N	\N	[]	2026-03-11 06:09:52.983506+00	2026-03-11 06:09:52.983506+00
6f6237a4-c840-48d6-a4c7-5ff21f2688f9	1ebf18ab-278e-473d-ad49-a7e9cbf92691	24	\N	Service overall reliable but improvements in response time would help.	\N	[]	2026-03-11 06:10:05.039645+00	2026-03-11 06:10:05.039645+00
6795592e-2c0b-4175-829c-f7c10dd168ad	dc527422-fa4d-49c5-80cd-8a2d772c23a3	1	3	\N	\N	[]	2026-03-11 06:25:41.155727+00	2026-03-11 06:25:41.155727+00
40c5deeb-f234-4c6f-8512-435d67123d01	dc527422-fa4d-49c5-80cd-8a2d772c23a3	2	0	\N	\N	[]	2026-03-11 06:25:46.791474+00	2026-03-11 06:25:46.791474+00
101667fe-46c8-44f8-b6fd-6e862816d909	dc527422-fa4d-49c5-80cd-8a2d772c23a3	3	3	\N	\N	[]	2026-03-11 06:25:54.826134+00	2026-03-11 06:25:54.826134+00
d2bc5079-4c56-487f-a75d-32ca79b85384	dc527422-fa4d-49c5-80cd-8a2d772c23a3	4	\N	N	\N	[]	2026-03-11 06:25:57.764046+00	2026-03-11 06:25:57.764046+00
e6b3ccf4-1f46-4f64-ad82-fba2db38774d	dc527422-fa4d-49c5-80cd-8a2d772c23a3	5	3	\N	\N	[]	2026-03-11 06:26:06.483845+00	2026-03-11 06:26:06.483845+00
24287fea-d3a2-4e36-b234-6de1000ebf6d	dc527422-fa4d-49c5-80cd-8a2d772c23a3	6	\N	N	\N	[]	2026-03-11 06:27:19.118358+00	2026-03-11 06:27:19.118358+00
75e025fa-d502-4a95-a353-0092ca69ea76	dc527422-fa4d-49c5-80cd-8a2d772c23a3	7	\N	Dedicated Internet connectivity, MPLS site connectivity, Basic business support line	\N	[]	2026-03-11 06:27:39.476337+00	2026-03-11 06:27:39.476337+00
fe0ca88d-817f-42ac-b3b4-b617f32d1195	dc527422-fa4d-49c5-80cd-8a2d772c23a3	8	\N	Frequent network outages at warehouse location, slow fault resolution during fiber cut in April, billing discrepancies requiring multiple follow-ups	\N	[]	2026-03-11 06:28:00.11837+00	2026-03-11 06:28:00.11837+00
09a9dbc5-2697-40e7-a8b3-04ffb0020957	dc527422-fa4d-49c5-80cd-8a2d772c23a3	9	\N	Never	\N	[]	2026-03-11 06:28:07.512953+00	2026-03-11 06:28:07.512953+00
03fe4e48-f552-46c2-8fe7-b52b288c7a7b	dc527422-fa4d-49c5-80cd-8a2d772c23a3	10	\N	Always	\N	[]	2026-03-11 06:28:15.154682+00	2026-03-11 06:28:15.154682+00
cf7ea869-5f14-426b-b3cb-d8d103974fe7	dc527422-fa4d-49c5-80cd-8a2d772c23a3	11	\N	Ongoing intermittent connectivity at the Port Victoria warehouse that has not been resolved for over two weeks	\N	[]	2026-03-11 06:28:27.25644+00	2026-03-11 06:28:27.25644+00
d42432f1-313a-4853-aa9c-f3b20e974564	dc527422-fa4d-49c5-80cd-8a2d772c23a3	12	3	\N	\N	[]	2026-03-11 06:28:34.269755+00	2026-03-11 06:28:34.269755+00
4aee5c1b-32bb-4bf2-a214-df858cf2fcb1	dc527422-fa4d-49c5-80cd-8a2d772c23a3	13	\N	Reliability, Fault Resolution, Price	\N	[]	2026-03-11 06:28:51.535552+00	2026-03-11 06:28:51.535552+00
d2b772d6-a62f-4f23-a863-6dced58fecad	dc527422-fa4d-49c5-80cd-8a2d772c23a3	14	\N	Sometimes	\N	[]	2026-03-11 06:28:57.544094+00	2026-03-11 06:28:57.544094+00
946e7a67-641d-4822-b598-9fbd40fbc6db	dc527422-fa4d-49c5-80cd-8a2d772c23a3	15	\N	MPLS connectivity between offices, Dedicated Internet access, SIP voice services	\N	[]	2026-03-11 06:29:19.157631+00	2026-03-11 06:29:19.157631+00
85a7edf0-6e8d-4a40-95b7-933f1f37e213	dc527422-fa4d-49c5-80cd-8a2d772c23a3	16	\N	Y	\N	[]	2026-03-11 06:29:30.514434+00	2026-03-11 06:29:30.514434+00
fc178418-7b8a-42dc-ae6b-48e2c37234c5	dc527422-fa4d-49c5-80cd-8a2d772c23a3	17	\N	Intelvision broadband backup connection	\N	[]	2026-03-11 06:30:10.646164+00	2026-03-11 06:30:10.646164+00
6570d09a-1fbe-43bc-ac3b-4cf8a61b9cdd	dc527422-fa4d-49c5-80cd-8a2d772c23a3	18	\N	Dedicated Internet pricing and SLA commitments	\N	[]	2026-03-11 06:30:26.687567+00	2026-03-11 06:30:26.687567+00
779e8e66-c2af-4812-bb9d-b9727c425c6a	dc527422-fa4d-49c5-80cd-8a2d772c23a3	19	\N	Looking at improving system reliability for logistics tracking and warehouse operations	\N	[]	2026-03-11 06:30:41.171828+00	2026-03-11 06:30:41.171828+00
6077418d-0816-410b-971b-531237e03faa	dc527422-fa4d-49c5-80cd-8a2d772c23a3	20	\N	Expanding warehouse operations and opening a small distribution office on Praslin	\N	[]	2026-03-11 06:31:05.374382+00	2026-03-11 06:31:05.374382+00
ffd6adc5-b9a1-4057-93de-ad518d6ff5a1	dc527422-fa4d-49c5-80cd-8a2d772c23a3	21	\N	Reliable fiber connectivity, backup LTE connection, improved network monitoring	\N	[]	2026-03-11 06:31:19.870928+00	2026-03-11 06:31:19.870928+00
6c0bc7c5-fca1-42d3-a6f6-83e670bddba2	dc527422-fa4d-49c5-80cd-8a2d772c23a3	22	\N	Faster response times for outages and more proactive communication when faults occur	\N	[]	2026-03-11 06:31:38.145583+00	2026-03-11 06:31:38.145583+00
70a482ce-dc51-4d51-a4f8-f94aea7d9576	dc527422-fa4d-49c5-80cd-8a2d772c23a3	24	\N	Service reliability has been a challenge for us. We are considering alternative providers if network stability does not improve soon.	\N	[]	2026-03-11 06:32:08.388325+00	2026-03-11 06:32:08.388325+00
44402577-a97c-40f4-b3ef-d9d13f1954ce	200bb9ec-6f98-4b9f-af32-fd9f6be2ab49	1	7	\N	\N	[]	2026-03-11 06:55:00.652702+00	2026-03-11 06:55:00.652702+00
fc9fe54f-235c-42ef-b508-2d0eeccf2d89	200bb9ec-6f98-4b9f-af32-fd9f6be2ab49	2	9	\N	\N	[]	2026-03-11 06:55:06.151629+00	2026-03-11 06:55:06.151629+00
0a1edcca-04ee-4b3e-b104-ba4a82fa0cfb	200bb9ec-6f98-4b9f-af32-fd9f6be2ab49	3	9	\N	\N	[]	2026-03-11 06:55:19.264445+00	2026-03-11 06:55:19.264445+00
5bafe97e-c7e5-49b6-9994-b74d4353caaf	200bb9ec-6f98-4b9f-af32-fd9f6be2ab49	4	\N	Y	\N	[]	2026-03-11 06:55:36.93505+00	2026-03-11 06:55:36.93505+00
f08184fd-26ba-4de7-87e6-f87a45566f29	1d4ca73c-d941-468a-813d-f55d52d3aa16	2	7	\N	\N	[]	2026-03-11 07:22:26.521828+00	2026-03-11 07:22:26.521828+00
68ada439-32f9-45d5-9787-5a5c49a3a1ac	1d4ca73c-d941-468a-813d-f55d52d3aa16	1	8	\N	\N	[]	2026-03-11 07:15:05.904646+00	2026-03-11 07:19:47.780699+00
b5fb1935-315b-43e0-aa8d-3785bc98b5f2	1d4ca73c-d941-468a-813d-f55d52d3aa16	3	7	\N	\N	[]	2026-03-11 07:22:30.993304+00	2026-03-11 07:22:30.993304+00
61e42071-69fb-491b-badb-7e89c0d06b6d	1d4ca73c-d941-468a-813d-f55d52d3aa16	4	\N	Y	\N	[]	2026-03-11 07:22:37.429998+00	2026-03-11 07:22:37.429998+00
ab6ccb91-baee-4ec4-9e93-c385adc0ce45	1d4ca73c-d941-468a-813d-f55d52d3aa16	6	\N	Y	\N	[]	2026-03-11 07:22:49.373385+00	2026-03-11 07:22:49.373385+00
5b9bd207-51d5-4fec-8b1d-df3c277e37a6	1d4ca73c-d941-468a-813d-f55d52d3aa16	5	9	\N	\N	[]	2026-03-11 07:22:49.354715+00	2026-03-11 07:22:49.354715+00
8f637229-e0f6-4f30-841b-1803de09786c	1d4ca73c-d941-468a-813d-f55d52d3aa16	7	\N	Cloud Connect, Dedicated Internet, SIP	\N	[]	2026-03-11 10:20:32.559626+00	2026-03-11 10:20:32.559626+00
04992573-0cc5-478b-9e44-e75b17c3dafc	1d4ca73c-d941-468a-813d-f55d52d3aa16	8	\N	Billing clarification delay, slow technician visit, intermittent connectivity	\N	[]	2026-03-11 10:20:45.286533+00	2026-03-11 10:20:45.286533+00
ba78620a-d94c-40e9-b191-e54ff537f835	1d4ca73c-d941-468a-813d-f55d52d3aa16	9	\N	Always	\N	[]	2026-03-11 10:20:58.93172+00	2026-03-11 10:20:58.93172+00
72382e6a-75cd-4e70-8270-d563d2e83423	1d4ca73c-d941-468a-813d-f55d52d3aa16	10	\N	Always	\N	[]	2026-03-11 10:21:07.265733+00	2026-03-11 10:21:07.265733+00
b561e3fc-a6e3-4c64-b457-d3fefe289804	1d4ca73c-d941-468a-813d-f55d52d3aa16	11	\N	none	\N	[]	2026-03-11 10:21:24.618368+00	2026-03-11 10:21:24.618368+00
2ed5a383-b02a-4a77-9901-50cf7d8a95b4	1d4ca73c-d941-468a-813d-f55d52d3aa16	12	7	\N	\N	[]	2026-03-11 10:21:31.231206+00	2026-03-11 10:22:50.643837+00
086446c2-f6b1-40b3-9ed8-6f38dca016ad	1d4ca73c-d941-468a-813d-f55d52d3aa16	13	\N	Reliability, Fault Resolution, Support	\N	[]	2026-03-11 10:23:03.156713+00	2026-03-11 10:23:03.156713+00
248355a7-f081-4ad4-bbd9-7c4ade07cde4	1d4ca73c-d941-468a-813d-f55d52d3aa16	14	\N	Sometimes	\N	[]	2026-03-11 10:23:34.993774+00	2026-03-11 10:23:34.993774+00
e09ab7d6-0f6e-4983-8270-133279d34217	1d4ca73c-d941-468a-813d-f55d52d3aa16	15	\N	Fiber DIA, Cloud Connect	\N	[]	2026-03-11 10:23:54.475588+00	2026-03-11 10:23:54.475588+00
919dc489-64ca-48d0-8115-11b7ec3afdee	1d4ca73c-d941-468a-813d-f55d52d3aa16	16	\N	Y	\N	[]	2026-03-11 10:24:03.970399+00	2026-03-11 10:24:03.970399+00
94099026-2978-4efc-aee9-9e958c21a629	1d4ca73c-d941-468a-813d-f55d52d3aa16	17	\N	Intelvision Broadband	\N	[]	2026-03-11 10:25:35.471547+00	2026-03-11 10:26:23.890255+00
7d717e81-6e77-466b-b538-3fa4c746f6ae	1d4ca73c-d941-468a-813d-f55d52d3aa16	18	\N	Review backup connectivity pricing	\N	[]	2026-03-11 10:26:51.643754+00	2026-03-11 10:26:51.643754+00
dbff2598-cb00-4eac-ad70-cd094aff1276	1d4ca73c-d941-468a-813d-f55d52d3aa16	19	\N	Upgrade connectivity across offices	\N	[]	2026-03-11 10:28:13.524696+00	2026-03-11 10:28:13.524696+00
1b939ac9-e462-46c4-8aab-e816267060ae	1d4ca73c-d941-468a-813d-f55d52d3aa16	20	\N	Opening new branch office	\N	[]	2026-03-11 10:28:30.374973+00	2026-03-11 10:28:30.374973+00
438d0553-3296-435e-a83c-3ea9b2ae0866	1d4ca73c-d941-468a-813d-f55d52d3aa16	21	\N	Enterprise WiFi and security	\N	[]	2026-03-11 10:28:45.256425+00	2026-03-11 10:28:45.256425+00
b43e3fcc-0a9a-4983-90b6-388d62b7aff9	1d4ca73c-d941-468a-813d-f55d52d3aa16	22	\N	Better pricing flexibility	\N	[]	2026-03-11 10:29:18.225124+00	2026-03-11 10:29:18.225124+00
8be8f75b-00cc-4219-b934-572bdaa7905a	1d4ca73c-d941-468a-813d-f55d52d3aa16	23	7	\N	\N	[]	2026-03-11 10:29:29.380362+00	2026-03-11 10:29:29.380362+00
094d0f12-469f-4c3e-991d-dbe9ab0a6f56	1d4ca73c-d941-468a-813d-f55d52d3aa16	24	\N	Service overall reliable but improvements in response time would help.	\N	[]	2026-03-11 10:29:46.593947+00	2026-03-11 10:29:46.593947+00
3de6ec67-e9cc-496b-b440-5fca7b609e05	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	49	5	\N	\N	[]	2026-03-13 10:26:07.376912+00	2026-03-13 10:26:07.376912+00
71652e99-e900-402f-9abd-d71ce1e24820	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	50	8	\N	\N	[]	2026-03-13 10:26:07.743114+00	2026-03-13 10:26:09.067628+00
3cfbdfce-5573-4be8-8710-82adb1d1d1e0	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	51	5	\N	\N	[]	2026-03-13 10:26:09.823847+00	2026-03-13 10:26:09.823847+00
6798a7fe-9fbf-43b8-949c-b436a1d0714d	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	52	\N	Y	\N	[]	2026-03-13 10:26:10.899119+00	2026-03-13 10:26:10.899119+00
1274b377-1c78-4e44-b182-373f2581f447	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	74	8	\N	\N	[]	2026-03-13 10:26:15.231104+00	2026-03-13 10:26:15.231104+00
7b732fc7-9f0d-40dd-9922-f3a4866b1990	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	73	5	\N	\N	[]	2026-03-13 10:26:16.152922+00	2026-03-13 10:26:16.152922+00
bdfeaa3d-abe3-4256-8808-cb77477fe987	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	72	7	\N	\N	[]	2026-03-13 10:26:17.01655+00	2026-03-13 10:26:17.01655+00
7a85bb11-c531-4e32-850e-5d0d4e83e9ef	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	71	\N	5 mins	\N	[]	2026-03-13 10:26:18.137915+00	2026-03-13 10:26:18.137915+00
2689e6c0-b46c-4b73-baeb-d66318974809	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	70	\N	waited 5 mins	\N	[]	2026-03-13 10:26:18.745015+00	2026-03-13 10:26:18.745015+00
c19e09dd-a5ba-4e48-8607-e9ac872159ea	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	69	7	\N	\N	[]	2026-03-13 10:26:19.625014+00	2026-03-13 10:26:19.625014+00
df72a8dd-9b05-4cbf-9af2-d871c3870090	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	68	4	\N	\N	[]	2026-03-13 10:26:20.152926+00	2026-03-13 10:26:20.152926+00
db0aefb0-80a0-4735-9e12-02d1a03a7088	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	67	4	\N	\N	[]	2026-03-13 10:26:21.156822+00	2026-03-13 10:26:21.156822+00
d422fe7a-f35a-407d-a26b-ed19f130bef9	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	66	5	\N	\N	[]	2026-03-13 10:26:21.608398+00	2026-03-13 10:26:21.608398+00
0966dd4f-c0d3-4e90-a43f-b723040f6e8b	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	65	5	\N	\N	[]	2026-03-13 10:26:22.111087+00	2026-03-13 10:26:22.111087+00
13ba8b8b-7461-4b31-996e-92f97849e861	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	64	\N	Y	\N	[]	2026-03-13 10:26:23.095722+00	2026-03-13 10:26:23.095722+00
58f02b66-be99-47a4-b3b9-eeca99bc69ef	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	63	\N	Y	\N	[]	2026-03-13 10:26:23.553703+00	2026-03-13 10:26:23.553703+00
6b651f7e-45e2-4c14-b0b3-1875d15bf6c9	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	62	5	\N	\N	[]	2026-03-13 10:26:24.662046+00	2026-03-13 10:26:24.662046+00
cf911b6b-7f2a-47f7-8756-16d0e31d62c5	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	61	4	\N	\N	[]	2026-03-13 10:26:25.094995+00	2026-03-13 10:26:25.094995+00
39c531a6-7315-4079-8968-68f45f355a2b	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	60	7	\N	\N	[]	2026-03-13 10:26:25.635487+00	2026-03-13 10:26:25.635487+00
3d3eb245-c3c1-44aa-a1c9-0b4f5ef8c7c7	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	59	\N	Y	\N	[]	2026-03-13 10:26:26.275707+00	2026-03-13 10:26:26.275707+00
\.


--
-- Data for Name: businesses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.businesses (id, name, location, account_executive_id, priority_flag, active, created_at, priority_level) FROM stdin;
1	Air Seychelles	Mahe	1	f	t	2026-02-25 10:21:56.153304+00	high
2	Four Seasons	Mahe	1	f	t	2026-02-25 10:21:56.153304+00	high
3	State House	Victoria	1	f	t	2026-02-25 10:21:56.153304+00	medium
5	Avani	Anse Royale	1	f	t	2026-02-26 05:37:06.791162+00	medium
6	Test - Drake Seaside	\N	\N	f	t	2026-02-26 06:23:54.931346+00	medium
4	Hilton	Mahe	1	f	t	2026-02-25 10:21:56.153304+00	low
11	Savoy Resort & Spa	Beau Vallon	1	f	t	2026-03-11 05:57:59.68151+00	medium
13	Eden Island Development	\N	\N	f	t	2026-03-11 07:14:46.166336+00	medium
7	Test 2 - DM APartments	\N	\N	f	t	2026-02-26 06:31:12.772681+00	medium
18	Victoria	Victoria	\N	f	t	2026-03-13 06:47:24.1015+00	medium
14	MS Smoke 20260312-114119	MS Smoke 20260312-114119	\N	f	t	2026-03-12 07:41:24.027008+00	medium
15	MS Smoke 20260312-114905	MS Smoke 20260312-114905	\N	f	t	2026-03-12 07:49:08.818731+00	medium
16	MS Smoke 20260312-115559	MS Smoke 20260312-115559	\N	f	t	2026-03-12 07:56:04.479604+00	medium
17	MS Smoke 20260312-132630	MS Smoke 20260312-132630	\N	f	t	2026-03-12 09:26:34.885916+00	medium
\.


--
-- Data for Name: file_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.file_attachments (filename, original_filename, file_path, file_size, mime_type, uploaded_by, program_id, id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mystery_shopper_locations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mystery_shopper_locations (id, name, business_id, active, created_at, updated_at) FROM stdin;
5	Victoria	18	t	2026-03-13 06:47:24.1015+00	2026-03-13 06:47:24.1015+00
1	MS Smoke 20260312-114119	14	t	2026-03-12 07:41:24.027008+00	2026-03-13 09:56:06.355619+00
2	MS Smoke 20260312-114905	15	t	2026-03-12 07:49:08.818731+00	2026-03-13 09:56:06.355619+00
3	MS Smoke 20260312-115559	16	t	2026-03-12 07:56:04.479604+00	2026-03-13 09:56:06.355619+00
4	MS Smoke 20260312-132630	17	t	2026-03-12 09:26:34.885916+00	2026-03-13 09:56:06.355619+00
\.


--
-- Data for Name: visits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.visits (id, business_id, representative_id, visit_date, visit_type, status, reviewer_id, review_timestamp, change_notes, approval_timestamp, approval_notes, rejection_notes, created_at, created_by, escalation_occurred, issue_experienced, survey_type_id) FROM stdin;
b63a18df-ac1e-4151-928c-7d3dc6f348d8	1	4	2026-03-10	Planned	Approved	\N	\N	\N	2026-03-10 06:00:22.48704+00	\N	\N	2026-03-10 05:46:10.638855+00	4	f	f	1
1d8fd31e-123f-4ffa-8a0f-7f98f9df63be	4	4	2026-03-10	Planned	Approved	\N	\N	\N	2026-03-10 06:17:54.473724+00	\N	\N	2026-03-10 05:45:06.28347+00	13	f	f	1
038e2140-a6ad-4320-9092-c04e6249cbd4	2	4	2026-03-10	Planned	Approved	\N	\N	\N	2026-03-10 07:48:02.772781+00	\N	\N	2026-03-10 06:23:25.745267+00	4	f	f	1
2c007ba1-1aca-41b0-81b4-63263a664a38	7	7	2026-03-13	Substitution	Draft	\N	\N	\N	\N	\N	\N	2026-02-26 06:31:12.798142+00	4	f	f	1
1ebf18ab-278e-473d-ad49-a7e9cbf92691	11	4	2026-03-11	Planned	Approved	\N	\N	\N	2026-03-11 06:10:45.139881+00	\N	\N	2026-03-11 05:58:22.739993+00	4	f	f	1
200bb9ec-6f98-4b9f-af32-fd9f6be2ab49	7	4	2026-03-12	Planned	Draft	\N	\N	\N	\N	\N	\N	2026-02-26 11:57:38.973978+00	4	f	f	1
1d4ca73c-d941-468a-813d-f55d52d3aa16	13	4	2026-03-11	Substitution	Approved	\N	\N	\N	2026-03-11 10:30:22.688759+00	\N	\N	2026-03-11 07:14:46.243984+00	4	f	f	1
b6980b9b-bf35-4780-a8ed-05697b4f567b	14	3	2026-03-12	Planned	Pending	\N	\N	\N	\N	\N	\N	2026-03-12 07:41:24.093873+00	3	f	f	2
8329123e-950c-47c2-b1be-96fe231d0560	15	3	2026-03-12	Planned	Pending	\N	\N	\N	\N	\N	\N	2026-03-12 07:49:08.919964+00	3	f	f	2
a6fd47e8-d9fe-498b-b5a2-9977f94e61e5	16	3	2026-03-12	Planned	Pending	\N	\N	\N	\N	\N	\N	2026-03-12 07:56:04.557803+00	3	f	f	2
efe41e98-7770-4aef-9417-8510b932d393	17	3	2026-03-12	Planned	Pending	\N	\N	\N	\N	\N	\N	2026-03-12 09:26:34.973182+00	3	f	f	2
6f401383-9c69-41cd-a0e8-c40ec3f0ca12	14	3	2026-03-13	Planned	Draft	\N	\N	\N	\N	\N	\N	2026-03-13 10:23:57.218907+00	3	f	f	2
0e553a58-44fc-418f-8803-9505c1fc0d0f	6	13	2026-03-11	Planned	Approved	\N	\N	\N	2026-03-09 10:49:01.213956+00	\N	\N	2026-02-26 06:23:54.968316+00	4	f	f	1
\.


--
-- Data for Name: mystery_shopper_assessments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mystery_shopper_assessments (id, visit_id, location_id, visit_time, purpose_of_visit, staff_on_duty, shopper_name, report_completed_date, created_at, updated_at) FROM stdin;
1	b6980b9b-bf35-4780-a8ed-05697b4f567b	1	10:30	General Enquiry	Smoke Test Staff	Smoke Test Shopper	2026-03-12	2026-03-12 07:41:24.093873+00	2026-03-12 07:41:24.230005+00
2	8329123e-950c-47c2-b1be-96fe231d0560	2	10:30	General Enquiry	Smoke Test Staff	Smoke Test Shopper	2026-03-12	2026-03-12 07:49:08.919964+00	2026-03-12 07:49:09.089078+00
3	a6fd47e8-d9fe-498b-b5a2-9977f94e61e5	3	10:30	General Enquiry	Smoke Test Staff	Smoke Test Shopper	2026-03-12	2026-03-12 07:56:04.557803+00	2026-03-12 07:56:04.701479+00
4	efe41e98-7770-4aef-9417-8510b932d393	4	10:30	General Enquiry	Smoke Test Staff	Smoke Test Shopper	2026-03-12	2026-03-12 09:26:34.973182+00	2026-03-12 09:26:35.137239+00
5	6f401383-9c69-41cd-a0e8-c40ec3f0ca12	1	14:26	General Enquiry	Test Person1	Test 1	\N	2026-03-13 10:23:57.218907+00	2026-03-13 10:23:57.218907+00
\.


--
-- Data for Name: mystery_shopper_purpose_options; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.mystery_shopper_purpose_options (id, name, active, sort_order, created_at, updated_at) FROM stdin;
1	General Enquiry	t	1	2026-03-13 07:03:22.966809+00	2026-03-13 07:03:22.966809+00
2	Billing	t	2	2026-03-13 07:03:22.966809+00	2026-03-13 07:03:22.966809+00
3	Device	t	3	2026-03-13 07:03:22.966809+00	2026-03-13 07:03:22.966809+00
4	Broadband	t	4	2026-03-13 07:03:22.966809+00	2026-03-13 07:03:22.966809+00
5	Complaint	t	5	2026-03-13 07:03:22.966809+00	2026-03-13 08:02:58.383491+00
6	Other	t	6	2026-03-13 07:03:22.966809+00	2026-03-13 07:03:22.966809+00
\.


--
-- Data for Name: user_program_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_program_roles (user_id, program_id, role, id, created_at, updated_at) FROM stdin;
\.


--
-- Name: account_executives_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.account_executives_id_seq', 1, true);


--
-- Name: assessment_instances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.assessment_instances_id_seq', 1, false);


--
-- Name: assessment_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.assessment_templates_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- Name: businesses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.businesses_id_seq', 18, true);


--
-- Name: file_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.file_attachments_id_seq', 1, false);


--
-- Name: mystery_shopper_assessments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mystery_shopper_assessments_id_seq', 5, true);


--
-- Name: mystery_shopper_locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mystery_shopper_locations_id_seq', 5, true);


--
-- Name: mystery_shopper_purpose_options_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.mystery_shopper_purpose_options_id_seq', 1050, true);


--
-- Name: programs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.programs_id_seq', 24, true);


--
-- Name: questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.questions_id_seq', 534, true);


--
-- Name: survey_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.survey_types_id_seq', 314, true);


--
-- Name: user_program_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_program_roles_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 14, true);


--
-- PostgreSQL database dump complete
--

\unrestrict 8xa8OVovGsFeKh887uRDDzXKXO0UugRHXKSbmWlChEpC8XxytryPGdja4FNBD4d

