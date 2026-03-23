--
-- PostgreSQL database dump
--

\restrict cRauzTQtGkNypTREMCulc2LaWQemqC9MOBPlUZbJYNyJLxRAxN31lbmI06mGbvc

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
-- Name: visit_status; Type: TYPE; Schema: public; Owner: b2b
--

CREATE TYPE public.visit_status AS ENUM (
    'Draft',
    'Pending',
    'Needs Changes',
    'Approved',
    'Rejected'
);


ALTER TYPE public.visit_status OWNER TO b2b;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: b2b
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO b2b;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_executives; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.account_executives (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    email character varying(255) NOT NULL
);


ALTER TABLE public.account_executives OWNER TO b2b;

--
-- Name: account_executives_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.account_executives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.account_executives_id_seq OWNER TO b2b;

--
-- Name: account_executives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.account_executives_id_seq OWNED BY public.account_executives.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO b2b;

--
-- Name: assessment_instances; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.assessment_instances (
    program_id integer NOT NULL,
    template_version character varying(20) NOT NULL,
    respondent_id integer NOT NULL,
    context_id integer NOT NULL,
    context_type character varying(50) NOT NULL,
    title character varying(200),
    completed_at timestamp with time zone,
    status character varying(50) NOT NULL,
    submitted_by integer,
    approved_by integer,
    approved_at timestamp with time zone,
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.assessment_instances OWNER TO b2b;

--
-- Name: assessment_instances_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.assessment_instances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assessment_instances_id_seq OWNER TO b2b;

--
-- Name: assessment_instances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.assessment_instances_id_seq OWNED BY public.assessment_instances.id;


--
-- Name: assessment_templates; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.assessment_templates (
    program_id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    version character varying(20) NOT NULL,
    is_active boolean NOT NULL,
    created_by integer,
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.assessment_templates OWNER TO b2b;

--
-- Name: assessment_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.assessment_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assessment_templates_id_seq OWNER TO b2b;

--
-- Name: assessment_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.assessment_templates_id_seq OWNED BY public.assessment_templates.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    entity_type character varying(200) NOT NULL,
    entity_id character varying(200) NOT NULL,
    action character varying(200) NOT NULL,
    modified_by integer,
    "timestamp" timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO b2b;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO b2b;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: b2b_visit_responses; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.b2b_visit_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visit_id uuid NOT NULL,
    question_id integer NOT NULL,
    score integer,
    answer_text text,
    verbatim text,
    actions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.b2b_visit_responses OWNER TO b2b;

--
-- Name: businesses; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.businesses (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    location character varying(255),
    account_executive_id integer,
    priority_flag boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    priority_level character varying(20) DEFAULT 'medium'::character varying NOT NULL
);


ALTER TABLE public.businesses OWNER TO b2b;

--
-- Name: businesses_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.businesses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.businesses_id_seq OWNER TO b2b;

--
-- Name: businesses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.businesses_id_seq OWNED BY public.businesses.id;


--
-- Name: file_attachments; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.file_attachments (
    filename character varying(255) NOT NULL,
    original_filename character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer NOT NULL,
    mime_type character varying(100) NOT NULL,
    uploaded_by integer NOT NULL,
    program_id integer,
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.file_attachments OWNER TO b2b;

--
-- Name: file_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.file_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.file_attachments_id_seq OWNER TO b2b;

--
-- Name: file_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.file_attachments_id_seq OWNED BY public.file_attachments.id;


--
-- Name: mystery_shopper_assessments; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.mystery_shopper_assessments (
    id integer NOT NULL,
    visit_id uuid NOT NULL,
    location_id integer NOT NULL,
    visit_time character varying(20) NOT NULL,
    purpose_of_visit character varying(120) NOT NULL,
    staff_on_duty character varying(255) NOT NULL,
    shopper_name character varying(255) NOT NULL,
    report_completed_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.mystery_shopper_assessments OWNER TO b2b;

--
-- Name: mystery_shopper_assessments_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.mystery_shopper_assessments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mystery_shopper_assessments_id_seq OWNER TO b2b;

--
-- Name: mystery_shopper_assessments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.mystery_shopper_assessments_id_seq OWNED BY public.mystery_shopper_assessments.id;


--
-- Name: mystery_shopper_locations; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.mystery_shopper_locations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    business_id integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.mystery_shopper_locations OWNER TO b2b;

--
-- Name: mystery_shopper_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.mystery_shopper_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mystery_shopper_locations_id_seq OWNER TO b2b;

--
-- Name: mystery_shopper_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.mystery_shopper_locations_id_seq OWNED BY public.mystery_shopper_locations.id;


--
-- Name: mystery_shopper_purpose_options; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.mystery_shopper_purpose_options (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.mystery_shopper_purpose_options OWNER TO b2b;

--
-- Name: mystery_shopper_purpose_options_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.mystery_shopper_purpose_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mystery_shopper_purpose_options_id_seq OWNER TO b2b;

--
-- Name: mystery_shopper_purpose_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.mystery_shopper_purpose_options_id_seq OWNED BY public.mystery_shopper_purpose_options.id;


--
-- Name: programs; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.programs (
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    is_active boolean NOT NULL,
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.programs OWNER TO b2b;

--
-- Name: programs_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.programs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.programs_id_seq OWNER TO b2b;

--
-- Name: programs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.programs_id_seq OWNED BY public.programs.id;


--
-- Name: questions; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.questions (
    id integer NOT NULL,
    survey_type_id integer NOT NULL,
    question_number integer NOT NULL,
    question_text text NOT NULL,
    category character varying(200),
    is_mandatory boolean DEFAULT true,
    is_nps boolean DEFAULT false,
    input_type character varying(50) DEFAULT 'text'::character varying,
    score_min integer,
    score_max integer,
    choices jsonb,
    helper_text text,
    requires_issue boolean DEFAULT false,
    requires_escalation boolean DEFAULT false,
    question_key character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.questions OWNER TO b2b;

--
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.questions_id_seq OWNER TO b2b;

--
-- Name: questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.questions_id_seq OWNED BY public.questions.id;


--
-- Name: survey_types; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.survey_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.survey_types OWNER TO b2b;

--
-- Name: survey_types_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.survey_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.survey_types_id_seq OWNER TO b2b;

--
-- Name: survey_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.survey_types_id_seq OWNED BY public.survey_types.id;


--
-- Name: user_program_roles; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.user_program_roles (
    user_id integer NOT NULL,
    program_id integer NOT NULL,
    role character varying(50) NOT NULL,
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_program_roles OWNER TO b2b;

--
-- Name: user_program_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.user_program_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_program_roles_id_seq OWNER TO b2b;

--
-- Name: user_program_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.user_program_roles_id_seq OWNED BY public.user_program_roles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO b2b;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: b2b
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO b2b;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: b2b
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: visits; Type: TABLE; Schema: public; Owner: b2b
--

CREATE TABLE public.visits (
    id uuid NOT NULL,
    business_id integer NOT NULL,
    representative_id integer NOT NULL,
    visit_date date NOT NULL,
    visit_type character varying(50) NOT NULL,
    status public.visit_status NOT NULL,
    reviewer_id integer,
    review_timestamp timestamp with time zone,
    change_notes character varying(2000),
    approval_timestamp timestamp with time zone,
    approval_notes character varying(2000),
    rejection_notes character varying(2000),
    created_at timestamp with time zone DEFAULT now(),
    created_by integer NOT NULL,
    escalation_occurred boolean DEFAULT false NOT NULL,
    issue_experienced boolean DEFAULT false NOT NULL,
    survey_type_id integer
);


ALTER TABLE public.visits OWNER TO b2b;

--
-- Name: account_executives id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.account_executives ALTER COLUMN id SET DEFAULT nextval('public.account_executives_id_seq'::regclass);


--
-- Name: assessment_instances id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.assessment_instances ALTER COLUMN id SET DEFAULT nextval('public.assessment_instances_id_seq'::regclass);


--
-- Name: assessment_templates id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.assessment_templates ALTER COLUMN id SET DEFAULT nextval('public.assessment_templates_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: businesses id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.businesses ALTER COLUMN id SET DEFAULT nextval('public.businesses_id_seq'::regclass);


--
-- Name: file_attachments id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.file_attachments ALTER COLUMN id SET DEFAULT nextval('public.file_attachments_id_seq'::regclass);


--
-- Name: mystery_shopper_assessments id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_assessments ALTER COLUMN id SET DEFAULT nextval('public.mystery_shopper_assessments_id_seq'::regclass);


--
-- Name: mystery_shopper_locations id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_locations ALTER COLUMN id SET DEFAULT nextval('public.mystery_shopper_locations_id_seq'::regclass);


--
-- Name: mystery_shopper_purpose_options id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_purpose_options ALTER COLUMN id SET DEFAULT nextval('public.mystery_shopper_purpose_options_id_seq'::regclass);


--
-- Name: programs id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.programs ALTER COLUMN id SET DEFAULT nextval('public.programs_id_seq'::regclass);


--
-- Name: questions id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.questions ALTER COLUMN id SET DEFAULT nextval('public.questions_id_seq'::regclass);


--
-- Name: survey_types id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.survey_types ALTER COLUMN id SET DEFAULT nextval('public.survey_types_id_seq'::regclass);


--
-- Name: user_program_roles id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.user_program_roles ALTER COLUMN id SET DEFAULT nextval('public.user_program_roles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: account_executives account_executives_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.account_executives
    ADD CONSTRAINT account_executives_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: assessment_instances assessment_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.assessment_instances
    ADD CONSTRAINT assessment_instances_pkey PRIMARY KEY (id);


--
-- Name: assessment_templates assessment_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.assessment_templates
    ADD CONSTRAINT assessment_templates_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: b2b_visit_responses b2b_visit_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.b2b_visit_responses
    ADD CONSTRAINT b2b_visit_responses_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: file_attachments file_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_pkey PRIMARY KEY (id);


--
-- Name: mystery_shopper_assessments mystery_shopper_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_assessments
    ADD CONSTRAINT mystery_shopper_assessments_pkey PRIMARY KEY (id);


--
-- Name: mystery_shopper_assessments mystery_shopper_assessments_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_assessments
    ADD CONSTRAINT mystery_shopper_assessments_visit_id_key UNIQUE (visit_id);


--
-- Name: mystery_shopper_locations mystery_shopper_locations_name_key; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_locations
    ADD CONSTRAINT mystery_shopper_locations_name_key UNIQUE (name);


--
-- Name: mystery_shopper_locations mystery_shopper_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_locations
    ADD CONSTRAINT mystery_shopper_locations_pkey PRIMARY KEY (id);


--
-- Name: mystery_shopper_purpose_options mystery_shopper_purpose_options_name_key; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_purpose_options
    ADD CONSTRAINT mystery_shopper_purpose_options_name_key UNIQUE (name);


--
-- Name: mystery_shopper_purpose_options mystery_shopper_purpose_options_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_purpose_options
    ADD CONSTRAINT mystery_shopper_purpose_options_pkey PRIMARY KEY (id);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- Name: questions questions_survey_type_id_question_number_key; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_survey_type_id_question_number_key UNIQUE (survey_type_id, question_number);


--
-- Name: survey_types survey_types_name_key; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.survey_types
    ADD CONSTRAINT survey_types_name_key UNIQUE (name);


--
-- Name: survey_types survey_types_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.survey_types
    ADD CONSTRAINT survey_types_pkey PRIMARY KEY (id);


--
-- Name: questions uq_questions_question_key; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT uq_questions_question_key UNIQUE (question_key);


--
-- Name: user_program_roles user_program_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.user_program_roles
    ADD CONSTRAINT user_program_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: visits visits_pkey; Type: CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_pkey PRIMARY KEY (id);


--
-- Name: idx_b2b_visit_responses_question; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX idx_b2b_visit_responses_question ON public.b2b_visit_responses USING btree (question_id);


--
-- Name: idx_b2b_visit_responses_visit; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX idx_b2b_visit_responses_visit ON public.b2b_visit_responses USING btree (visit_id);


--
-- Name: idx_questions_number; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX idx_questions_number ON public.questions USING btree (survey_type_id, question_number);


--
-- Name: idx_questions_survey_type; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX idx_questions_survey_type ON public.questions USING btree (survey_type_id);


--
-- Name: idx_visits_survey_type_id; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX idx_visits_survey_type_id ON public.visits USING btree (survey_type_id);


--
-- Name: ix_assessment_instances_context_id; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX ix_assessment_instances_context_id ON public.assessment_instances USING btree (context_id);


--
-- Name: ix_assessment_instances_program_id; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX ix_assessment_instances_program_id ON public.assessment_instances USING btree (program_id);


--
-- Name: ix_assessment_instances_respondent_id; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX ix_assessment_instances_respondent_id ON public.assessment_instances USING btree (respondent_id);


--
-- Name: ix_assessment_templates_program_id; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX ix_assessment_templates_program_id ON public.assessment_templates USING btree (program_id);


--
-- Name: ix_programs_code; Type: INDEX; Schema: public; Owner: b2b
--

CREATE UNIQUE INDEX ix_programs_code ON public.programs USING btree (code);


--
-- Name: ix_user_program_roles_program_id; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX ix_user_program_roles_program_id ON public.user_program_roles USING btree (program_id);


--
-- Name: ix_user_program_roles_user_id; Type: INDEX; Schema: public; Owner: b2b
--

CREATE INDEX ix_user_program_roles_user_id ON public.user_program_roles USING btree (user_id);


--
-- Name: questions update_questions_updated_at; Type: TRIGGER; Schema: public; Owner: b2b
--

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: b2b_visit_responses update_responses_updated_at; Type: TRIGGER; Schema: public; Owner: b2b
--

CREATE TRIGGER update_responses_updated_at BEFORE UPDATE ON public.b2b_visit_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: survey_types update_survey_types_updated_at; Type: TRIGGER; Schema: public; Owner: b2b
--

CREATE TRIGGER update_survey_types_updated_at BEFORE UPDATE ON public.survey_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assessment_instances assessment_instances_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.assessment_instances
    ADD CONSTRAINT assessment_instances_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: assessment_instances assessment_instances_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.assessment_instances
    ADD CONSTRAINT assessment_instances_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id);


--
-- Name: assessment_instances assessment_instances_respondent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.assessment_instances
    ADD CONSTRAINT assessment_instances_respondent_id_fkey FOREIGN KEY (respondent_id) REFERENCES public.users(id);


--
-- Name: assessment_instances assessment_instances_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.assessment_instances
    ADD CONSTRAINT assessment_instances_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id);


--
-- Name: assessment_templates assessment_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.assessment_templates
    ADD CONSTRAINT assessment_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: assessment_templates assessment_templates_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.assessment_templates
    ADD CONSTRAINT assessment_templates_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id);


--
-- Name: audit_logs audit_logs_modified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_modified_by_fkey FOREIGN KEY (modified_by) REFERENCES public.users(id);


--
-- Name: b2b_visit_responses b2b_visit_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.b2b_visit_responses
    ADD CONSTRAINT b2b_visit_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- Name: businesses businesses_account_executive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_account_executive_id_fkey FOREIGN KEY (account_executive_id) REFERENCES public.account_executives(id);


--
-- Name: file_attachments file_attachments_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id);


--
-- Name: file_attachments file_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.file_attachments
    ADD CONSTRAINT file_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: visits fk_visits_survey_type_id; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT fk_visits_survey_type_id FOREIGN KEY (survey_type_id) REFERENCES public.survey_types(id);


--
-- Name: mystery_shopper_assessments mystery_shopper_assessments_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_assessments
    ADD CONSTRAINT mystery_shopper_assessments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.mystery_shopper_locations(id);


--
-- Name: mystery_shopper_assessments mystery_shopper_assessments_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_assessments
    ADD CONSTRAINT mystery_shopper_assessments_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: mystery_shopper_locations mystery_shopper_locations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.mystery_shopper_locations
    ADD CONSTRAINT mystery_shopper_locations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: questions questions_survey_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_survey_type_id_fkey FOREIGN KEY (survey_type_id) REFERENCES public.survey_types(id);


--
-- Name: visits visits_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: visits visits_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: visits visits_representative_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_representative_id_fkey FOREIGN KEY (representative_id) REFERENCES public.users(id);


--
-- Name: visits visits_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: b2b
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict cRauzTQtGkNypTREMCulc2LaWQemqC9MOBPlUZbJYNyJLxRAxN31lbmI06mGbvc

