-- Transitional document model used by the compatibility API.
-- It preserves existing collection/document IDs while the application is migrated.
create table if not exists documents (
  path text primary key,
  collection_path text not null,
  document_id text not null,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_collection_idx on documents(collection_path);
create index if not exists documents_data_gin_idx on documents using gin(data);
create table if not exists migration_runs (
  id uuid primary key,
  source text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null,
  details jsonb not null default '{}'::jsonb
);
