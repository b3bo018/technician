-- SecureTrack Technician PostgreSQL baseline. IDs are text to preserve existing Firebase document IDs.
create table if not exists app_users(id text primary key,email text unique not null,display_name text not null default '',role text not null,status text not null default 'active',photo_url text,created_at timestamptz not null default now());
create table if not exists shifts(id text primary key,data jsonb not null,technician_id text,job_reference text unique,status text,scheduled_at timestamptz,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists shifts_technician_schedule on shifts(technician_id,scheduled_at);
create table if not exists installations(id text primary key,shift_id text,technician_id text,data jsonb not null,completed_at timestamptz not null default now());
create table if not exists inventory_accounts(technician_id text primary key,data jsonb not null,updated_at timestamptz not null default now());
create table if not exists inventory_logs(id text primary key,technician_id text,data jsonb not null,created_at timestamptz not null default now());
create table if not exists technician_live_stock(technician_id text primary key,balance jsonb not null,updated_at timestamptz not null default now());
create table if not exists assignment_index(kind text not null,value text not null,data jsonb not null,status text not null,vehicle text,primary key(kind,value));
create table if not exists work_sessions(id text primary key,technician_id text not null,data jsonb not null,clock_in_at timestamptz not null default now(),clock_out_at timestamptz);
create table if not exists work_breaks(id text primary key,session_id text not null,technician_id text not null,data jsonb not null,started_at timestamptz not null default now(),ended_at timestamptz);
create table if not exists operational_notifications(id text primary key,data jsonb not null,created_at timestamptz not null default now());
create table if not exists audit_logs(id text primary key,actor_uid text,action text not null,section text not null,record_id text,data jsonb not null,created_at timestamptz not null default now());
create table if not exists settings(key text primary key,data jsonb not null,updated_at timestamptz not null default now());
create table if not exists counters(key text primary key,value bigint not null default 0,updated_at timestamptz not null default now());
create table if not exists agreements(id text primary key,data jsonb not null,updated_at timestamptz not null default now());
-- Prevent overlapping assigned jobs per technician at the API transaction layer using SELECT ... FOR UPDATE.
-- assignment_index primary key + row locks preserve unique active IMEI/SIM assignment semantics.

create table if not exists attendance_logs(id text primary key,technician_id text not null,latitude double precision not null,longitude double precision not null,accuracy_m double precision not null,created_at timestamptz not null default now());
