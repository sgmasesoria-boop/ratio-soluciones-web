-- Ratio Soluciones · esquema simplificado de seguimiento, sin almacenamiento documental.
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  internal_role text not null default 'client' check (internal_role in ('client','professional','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  client_id uuid not null references public.profiles(id),
  client_name text not null,
  title text not null,
  category text not null,
  status text not null default 'open' check (status in ('open','study','action','response','resolution','closed','archived')),
  summary text,
  client_next_step text,
  professional_name text,
  professional_title text,
  professional_registration text,
  professional_region text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.case_members (
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_role text not null check (membership_role in ('owner','manager','professional','viewer')),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id),
  revoked_at timestamptz,
  primary key (case_id,user_id)
);

create table public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  visibility text not null default 'client' check (visibility in ('client','internal')),
  stage text,
  actor_id uuid references public.profiles(id),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  external_hint text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  case_id uuid references public.cases(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  object_type text not null,
  object_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index cases_client_idx on public.cases(client_id);
create index case_members_user_idx on public.case_members(user_id) where revoked_at is null;
create index case_events_case_time_idx on public.case_events(case_id,occurred_at);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create index audit_case_time_idx on public.audit_events(case_id,created_at desc);

create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger cases_touch before update on public.cases for each row execute function private.touch_updated_at();

create or replace function private.prevent_audit_changes()
returns trigger language plpgsql as $$
begin raise exception 'audit_events is append-only'; end; $$;
create trigger audit_no_update before update or delete on public.audit_events for each row execute function private.prevent_audit_changes();
